import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { z } from "zod";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

const BodySchema = z.object({
  pananaId: z.string().min(1),
  characterSlug: z.string().min(1),
  enPrompt: z.string().optional(),
  userMessage: z.string().optional(),
  assistantMessage: z.string().optional(),
  recentContext: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional(),
});

function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getSceneImageSettings(sb: SupabaseClient) {
  try {
    const tableRes = await sb
      .from("panana_site_settings")
      .select("scene_image_enabled, scene_image_daily_limit, scene_image_model, scene_image_steps, scene_image_vision_cache_minutes")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let data = tableRes.data as any;
    let error = tableRes.error as any;
    if (error) {
      const msg = String((error as any)?.message || "");
      if (msg.includes("permission denied") || msg.includes("does not exist") || msg.includes("column")) {
        const { data: viewData, error: viewError } = await sb
          .from("panana_public_site_settings_v")
          .select("scene_image_enabled, scene_image_daily_limit, scene_image_model, scene_image_steps, scene_image_vision_cache_minutes")
          .limit(1)
          .maybeSingle();
        data = viewData as any;
        error = viewError as any;
      }
    }
    if (error) {
      const msg = String((error as any)?.message || "");
      if (msg.includes("scene_image") || msg.includes("permission denied") || msg.includes("column")) {
        return { enabled: true, dailyLimit: 5, steps: 20, visionCacheMinutes: 60 };
      }
      throw error;
    }
    const r = data as any;
    const visionCacheMinutes = Math.max(0, Math.min(10080, Number(r?.scene_image_vision_cache_minutes) || 60));
    let steps = Math.max(8, Math.min(20, Number(r?.scene_image_steps) || 20));
    if (Number.isNaN(steps) || steps < 8 || steps > 20) {
      const modelRaw = String(r?.scene_image_model || "dev").trim().toLowerCase();
      steps = modelRaw === "schnell" ? 8 : 20;
    }
    return {
      enabled: r?.scene_image_enabled !== false,
      dailyLimit: Math.max(1, Math.min(100, Number(r?.scene_image_daily_limit) || 5)),
      steps,
      visionCacheMinutes,
    };
  } catch (e: any) {
    console.warn("[scene-image] getSceneImageSettings fallback:", e?.message);
    return { enabled: true, dailyLimit: 5, steps: 20, visionCacheMinutes: 60 };
  }
}

async function getTodayUsageCount(sb: SupabaseClient<any>, pananaId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const iso = todayStart.toISOString();
  const { count, error } = await sb
    .from("panana_scene_image_log")
    .select("*", { count: "exact", head: true })
    .eq("panana_id", pananaId)
    .gte("created_at", iso);
  if (error) return 0;
  return count ?? 0;
}

async function logUsage(sb: SupabaseClient<any>, pananaId: string, characterSlug?: string) {
  await sb.from("panana_scene_image_log").insert({
    panana_id: pananaId,
    ...(characterSlug ? { character_slug: characterSlug } : {}),
  } as any);
}

const APPEARANCE_KEYS = ["외형", "의상", "외모", "생김새", "appearance", "outfit", "costume"];

const visionAppearanceCache = new Map<string, { desc: string; ts: number }>();

async function callGeminiVision(args: {
  apiKey: string;
  system: string;
  text: string;
  base64: string;
  mimeType: string;
  maxTokens?: number;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents: [
        {
          parts: [
            { inlineData: { mimeType: args.mimeType, data: args.base64 } },
            { text: args.text },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: args.maxTokens ?? 384,
        responseMimeType: "text/plain",
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) return "";
  const parts = (data?.candidates as any[])?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => p?.text).filter(Boolean).join("\n").trim() : "";
}

async function isFullBodyImage(args: { imageUrl: string; apiKey: string }): Promise<boolean> {
  let base64: string;
  let mediaType = "image/jpeg";
  try {
    const res = await fetch(args.imageUrl);
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    base64 = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("png")) mediaType = "image/png";
    else if (ct.includes("webp")) mediaType = "image/webp";
  } catch {
    return false;
  }

  const system = `You are an image framing inspector.
Determine if the main person is shown as FULL BODY.
FULL BODY means head to toe is visible in a single frame, including both feet/shoes.
If legs or feet are cut out, or only upper/half body is shown, it is NOT full body.
Return strict JSON only: {"isFullBody": true} or {"isFullBody": false}.`;
  try {
    const raw = await callGeminiVision({
      apiKey: args.apiKey,
      system,
      text: "Is this a full body shot of the main person (head-to-toe with visible feet/shoes)? Return JSON only.",
      base64,
      mimeType: mediaType,
      maxTokens: 80,
    });
    const parsed = JSON.parse(String(raw || "{}")) as { isFullBody?: boolean };
    return Boolean(parsed?.isFullBody);
  } catch {
    return false;
  }
}

async function callGeminiText(args: {
  apiKey: string;
  system: string;
  userMessage: string;
  maxTokens?: number;
  responseSchema?: Record<string, unknown>;
  model?: string;
}): Promise<string> {
  const model = args.model || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const genConfig: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens: args.maxTokens ?? 256,
    responseMimeType: args.responseSchema ? "application/json" : "text/plain",
  };
  if (args.responseSchema) {
    genConfig.responseJsonSchema = args.responseSchema;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: args.system }] },
      contents: [{ parts: [{ text: args.userMessage }] }],
      generationConfig: genConfig,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errMsg = (data?.error as any)?.message || "";
    throw new Error(`Gemini API 오류 (${res.status})${errMsg ? `: ${errMsg}` : ""}`);
  }
  const parts = (data?.candidates as any[])?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p: any) => p?.text).filter(Boolean).join("\n").trim() : "";
}

async function describeReferenceImage(imageUrl: string, cacheTtlMs: number): Promise<string> {
  const cached = visionAppearanceCache.get(imageUrl);
  if (cached && cacheTtlMs > 0 && Date.now() - cached.ts < cacheTtlMs) return cached.desc;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) return "";

  let base64: string;
  let mediaType = "image/jpeg";
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return "";
    const buf = await res.arrayBuffer();
    base64 = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("png")) mediaType = "image/png";
    else if (ct.includes("webp")) mediaType = "image/webp";
  } catch {
    return "";
  }

  const sys = `You are an expert at describing character appearance for AI image generation. Your description will be used as the FIXED appearance block so the generated image keeps the EXACT same outfit and hair.

CRITICAL: Describe ONLY what is clearly visible in the image. Do NOT add, assume, or invent any item (brooch, scarf, pin, necklace, tie, hat, etc.) that is not visible. If no scarf is visible, do not mention scarf. If a brooch or name tag is visible, describe it exactly. Consistency means: what exists stays, what does not exist must not appear.

MANDATORY - describe ALL visible elements in dense English:
1. HAIR: color, length, style, parting, bangs, hair accessories only if visible (clip/band/ribbon).
2. OUTFIT - each visible garment: top (color, fabric, neckline, sleeves, patterns), bottom if visible, layers. Accessories ONLY if visible: scarf, brooch, pin, name tag, necklace, earrings, belt, tie - with color and style. Omit any accessory not in the image.
3. FACE/BODY: glasses yes/no only if visible, makeup, skin tone if notable.

Output one dense paragraph. Start with "Wearing" or "She is wearing" / "He is wearing". No preamble. List only what you actually see - do not add anything.`;

  try {
    const raw = await callGeminiVision({
      apiKey,
      system: sys,
      text: "Describe outfit and hair for exact replication. List only what is visible: garments, then accessories (brooch, scarf, name tag, etc.) only if present. Do not add scarf/brooch/jewelry if not in the image. Use the MANDATORY checklist.",
      base64,
      mimeType: mediaType,
      maxTokens: 768,
    });
    const desc = String(raw || "").trim().slice(0, 950);
    if (desc) {
      visionAppearanceCache.set(imageUrl, { desc, ts: Date.now() });
      return desc;
    }
  } catch (e) {
    console.warn("[scene-image] describeReferenceImage:", (e as Error)?.message);
  }
  return "";
}

const WORLD_SUMMARY_MAX = 420;

/** 챗봇 응답에서 괄호 지문 추출 (이 턴 장면 묘사). (…) 또는 （…） 한/영 괄호 지원 */
function extractNarrativeFromMessage(assistantMessage: string): string {
  if (!assistantMessage || typeof assistantMessage !== "string") return "";
  const s = assistantMessage.trim();
  const matches = s.match(/[（(]([^）)]*)[）)]/g);
  if (!matches || matches.length === 0) return "";
  const combined = matches
    .map((m) => m.replace(/^[（(]|[）)]$/g, "").trim())
    .filter(Boolean)
    .join(". ");
  return combined.slice(0, 600);
}

/** 이 턴만의 차별점 1문장 (영어) — Gemini Flash로 추출, enPrompt 맨 앞에 배치 */
async function getSceneDifferentiator(
  userMessage: string,
  assistantMessage: string,
  narrativeBlock: string,
  geminiKey: string
): Promise<string> {
  const narrativeHint = narrativeBlock
    ? `[이번 턴 지문] ${narrativeBlock}\n\n`
    : "";
  const system = `You are an expert at summarizing a single scene moment for AI image generation.
${narrativeHint}[User] ${String(userMessage || "").slice(0, 400)}
[Assistant] ${String(assistantMessage || "").slice(0, 800)}

Output exactly ONE short English sentence that describes the ONE thing that MUST appear in this scene (action, gesture, location, expression, or key visual). Examples: "She is covering her mouth with her hand, surprised." "In a flower shop, holding a bouquet." "Winking playfully with one eye closed." No preamble. One sentence only.`;
  try {
    const raw = await callGeminiText({
      apiKey: geminiKey,
      system,
      userMessage: "Output the one mandatory scene differentiator sentence in English.",
      maxTokens: 120,
      model: "gemini-2.5-flash",
      responseSchema: {
        type: "object",
        properties: { differentiator: { type: "string" } },
        required: ["differentiator"],
      },
    });
    const parsed = JSON.parse(raw || "{}") as { differentiator?: string };
    const d = String(parsed?.differentiator ?? "").trim();
    return d ? d.slice(0, 200) : "";
  } catch {
    return "";
  }
}

/** 매 요청마다 다른 각도/쇼트 — 다양성 확보 */
const RANDOM_ANGLE_SHOT = [
  "3/4 view, slight side angle",
  "over the shoulder angle",
  "medium shot from the left",
  "medium shot from the right",
  "looking slightly away from camera",
  "slight low angle, medium shot",
  "candid angle, not centered",
];

const RANDOM_ANGLE_SHOT_FULL_BODY = [
  "full body shot, 3/4 view",
  "extreme wide shot, full body in frame",
  "full body shot from slight side angle",
  "head-to-toe standing pose, slight low angle",
  "full body candid angle, not centered",
];

const FULL_BODY_REQUEST_REGEX =
  /(전신\s*(사진|샷)?|머리부터\s*발끝|발끝까지|온몸|full[\s-]*body|head[\s-]*to[\s-]*toe|visible\s*(feet|shoes))/i;

function wantsFullBodyScene(args: {
  userMessage?: string;
  assistantMessage?: string;
  narrativeBlock?: string;
  recentContext?: { role: "user" | "assistant"; content: string }[];
}): boolean {
  const source = [
    String(args.userMessage || ""),
    String(args.assistantMessage || ""),
    String(args.narrativeBlock || ""),
    ...((args.recentContext || []).slice(-4).map((m) => String(m?.content || ""))),
  ]
    .join(" ")
    .trim();
  if (!source) return false;
  return FULL_BODY_REQUEST_REGEX.test(source);
}

function pickRandomAngleShot(forceFullBody = false): string {
  const pool = forceFullBody ? RANDOM_ANGLE_SHOT_FULL_BODY : RANDOM_ANGLE_SHOT;
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

async function getCharacterData(slug: string): Promise<{
  profileImageUrl: string | null;
  name: string;
  appearance: string;
  roleOrSetting: string;
  worldSummary: string;
}> {
  const supabase = getSupabaseAnon();
  const { data: charData, error: charErr } = await supabase
    .from("panana_public_characters_v")
    .select("profile_image_url, name, studio_character_id, intro_lines, tagline")
    .eq("slug", slug)
    .maybeSingle();
  if (charErr || !charData) {
    return { profileImageUrl: null, name: "", appearance: "", roleOrSetting: "", worldSummary: "" };
  }
  const profileImageUrl = String((charData as any)?.profile_image_url || "").trim() || null;
  const name = String((charData as any)?.name || "").trim() || "캐릭터";
  const studioCharacterId = (charData as any)?.studio_character_id;
  const introLines = (charData as any)?.intro_lines as string[] | undefined;
  const roleOrSetting = String((charData as any)?.tagline || "").trim();

  let appearance = "";
  let worldSummary = "";
  const keySet = new Set(APPEARANCE_KEYS.map((k) => k.toLowerCase()));

  if (studioCharacterId) {
    try {
      const { data: cRow } = await supabase
        .from("characters")
        .select("project_id")
        .eq("id", studioCharacterId)
        .maybeSingle();
      const projectId = (cRow as any)?.project_id;
      if (projectId) {
        const { data: loreRows } = await supabase
          .from("lorebook_entries")
          .select("key, value")
          .eq("project_id", projectId)
          .eq("scope", "character")
          .eq("character_id", studioCharacterId)
          .eq("active", true);
        const entries = (loreRows || []) as Array<{ key: string; value: string }>;
        const parts = entries
          .filter((e) => keySet.has(String(e.key || "").trim().toLowerCase()))
          .map((e) => String(e.value || "").trim())
          .filter(Boolean);
        if (parts.length) appearance = parts.join(". ");
        const fullLore = entries
          .map((e) => `${String(e.key || "").trim()}: ${String(e.value || "").trim()}`)
          .filter((s) => s.length > 1)
          .join(". ");
        if (fullLore) worldSummary = fullLore.slice(0, WORLD_SUMMARY_MAX);
      }
    } catch {
      /* studio tables may be inaccessible, fallback to intro_lines */
    }
  }
  if (!appearance && Array.isArray(introLines) && introLines.length > 0) {
    appearance = introLines.slice(0, 2).join(" ").trim();
  }
  return { profileImageUrl, name, appearance, roleOrSetting, worldSummary };
}

function parseEnPromptFromRaw(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  let parsed: { enPrompt?: string } | null = null;
  try {
    parsed = JSON.parse(trimmed) as { enPrompt?: string };
  } catch {
    const codeBlock = trimmed.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlock) {
      try {
        parsed = JSON.parse(codeBlock[1]) as { enPrompt?: string };
      } catch {
        /* ignore */
      }
    }
    if (!parsed) {
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]) as { enPrompt?: string };
        } catch {
          /* ignore */
        }
      }
    }
  }
  if (parsed && typeof parsed.enPrompt === "string") {
    const p = String(parsed.enPrompt).trim();
    return p ? p : null;
  }
  return null;
}

async function messageToEnPrompt(
  userMessage: string,
  assistantMessage: string,
  opts: {
    characterName?: string;
    appearance?: string;
    roleOrSetting?: string;
    worldSummary?: string;
    recentContext?: { role: string; content: string }[];
    /** 이 턴 괄호 지문 — enPrompt에 최우선 반영 */
    narrativeBlock?: string;
  }
): Promise<string> {
  const narrativeHint =
    opts.narrativeBlock &&
    `\n[이번 턴 지문 (필수 반영 - 장면·장소·액션·분위기를 여기서 최우선 추출)]\n${String(opts.narrativeBlock).slice(0, 600)}`;
  const appearanceHint = opts.appearance
    ? `\n[캐릭터 고정 정보 - 반드시 100% 유지] ${String(opts.appearance).slice(0, 500)}`
    : "";
  const roleHint =
    opts.roleOrSetting &&
    `\n[캐릭터 역할·상황 - 장면의 장소·동작이 이에 맞아야 함] ${String(opts.roleOrSetting).slice(0, 300)}
예: 스튜어디스 → 기내 갤리·통로에서 서 있거나 카트 옆, 승객용 좌석에 앉아 있는 모습 금지. 의사 → 진찰실·병원. 요리사 → 주방.`;
  const worldHint =
    opts.worldSummary &&
    `\n[캐릭터 세계관/로어북 요약 - 장면 배경·장소 참고 (이 턴 지문에 장소가 있으면 그걸 우선, 없으면 아래를 기본 배경으로 사용)]\n${String(opts.worldSummary).slice(0, WORLD_SUMMARY_MAX)}`;
  const ctxLines =
    opts.recentContext && opts.recentContext.length > 0
      ? "\n[최근 대화 맥락 - 장소·소품·감정 추출용]\n" +
        opts.recentContext
          .slice(-6)
          .map((m) => `[${m.role}] ${String(m.content || "").slice(0, 300)}`)
          .join("\n")
      : "";
  const system = `당신은 대화 장면을 Flux 이미지 생성용 영어 프롬프트로 변환합니다.
${narrativeHint || ""}
[유저] ${String(userMessage || "").slice(0, 500)}
[챗봇] ${String(assistantMessage || "").slice(0, 1500)}${appearanceHint}${roleHint || ""}${worldHint || ""}${ctxLines}

반드시 포함 (MANDATORY checklist):
1. STYLE (필수): 실사만 허용. enPrompt에 반드시 "photorealistic", "realistic photograph", "real person", "natural lighting" 포함. illustration, anime, cartoon, drawing, painting 스타일 금지.
2. OUTFIT/COLOR/ACCESSORIES: 의상·헤어·색상·악세서리는 enPrompt에서 새로 묘사하지 말 것. 참조와 동일한 복장·색상이 고정으로 들어감. 브로치·스카프·핀·네임택 등 있는 것은 있는 대로 유지, 없는데 갑자기 추가하면 안 됨. 대화맥락에서 의상 교체가 명시된 경우에만 의상 변경 허용; 그때도 색상·악세서리 톤 유지. 여기서는 장소·표정·포즈·쇼트만 작성.
3. PRIMARY ACTION (필수 - 최우선): 괄호 지문과 대화에서 가장 눈에 띄는 액션·제스처를 반드시 추출해 enPrompt 앞부분에 구체적 영어로 넣기. 이 액션이 생성 이미지에 반드시 보여야 함. 정면 미소만 나오는 결과 금지. 예: "손으로 입을 가린다"→"covering her mouth with her hand, fingers on lips, hand visible in frame", "윙크하며"→"winking playfully with one eye closed", "머리카락을 귀 뒤로 넘기며"→"tucking a strand of hair behind her ear, hand near ear", "눈을 동그랗게 뜬다"→"eyes wide open, surprised expression". 손 동작이 있으면 반드시 손이 프레임에 보이도록 묘사.
4. DIVERSITY (필수): 증명사진·여권사진 스타일(정면 얼굴만, 동일 포즈) 금지. 매번 다른 각도(3/4 view, slight side angle), 다른 표정, 다른 포즈. "front facing portrait", "looking at camera"만 반복 금지. 핵심 액션에 맞는 구도·표정으로 다양성 부여.
5. ROLE-APPROPRIATE LOCATION & BACKGROUND (필수): [캐릭터 역할·상황] 또는 [캐릭터 세계관/로어북 요약] 또는 지문(괄호)에 장소가 나오면 반드시 그 장소를 enPrompt에 구체적으로 영어로 넣기. 꽃가게→flower shop interior, flowers in vases, flower arrangements, plants, shop counter, (밤/골목→dim alley, neon sign "Luna", glass door). 카페→cafe interior, tables, coffee. 위에 세계관 요약이 있으면 그 안의 장소·소품을 반드시 배경에 반영. 사무실·회색 벽·빈 배경만 나오면 안 됨. "plain wall", "empty background", "generic office" 금지. 장소에 맞는 소품·가구·조명을 2문장 이상으로 상세히.
6. EXPRESSION/GESTURE: 3번 PRIMARY ACTION과 함께 지문·대화의 나머지 표정·제스처도 구체적 영어로. 단조로운 포즈·동일한 표정 반복 금지. "웃는다"→"smiling warmly", "고개 기울인다"→"tilting her head curiously".
7. SHOT: full body, medium shot, close-up 중 장면에 맞게 선택. 손·액션이 보이려면 medium shot 이상, 손이 프레임에 들어가도록.
8. QUALITY: detailed, sharp, high quality 추가. (출력 1024x768이므로 4k/cinematic 제외)

enPrompt는 100단어 이상으로 상세히. 다음 JSON만 출력: {"enPrompt": "영어 프롬프트"}`;

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY가 설정되어 있어야 해요.");
  }

  let prompt: string | null = null;
  {
    const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"] as const;
    for (const model of geminiModels) {
      try {
        const raw = await callGeminiText({
          apiKey: geminiKey,
          system,
          userMessage: "변환해줘. MANDATORY checklist 모두 포함. 3번 PRIMARY ACTION: 핵심 액션을 반드시 enPrompt에 넣고 손이 보이게. 4번 DIVERSITY: 증명사진처럼 정면만 똑같이 나오면 안 됨. 5번 배경: 지문/대화에 나온 장소(꽃가게·카페·골목 등)를 반드시 구체적으로—꽃가게면 flowers, vases, plants, shop interior; 회색 벽·사무실 배경 금지. enPrompt 100단어 이상 상세히.",
          maxTokens: 512,
          model,
          responseSchema: {
            type: "object",
            properties: { enPrompt: { type: "string" } },
            required: ["enPrompt"],
          },
        });
        prompt = parseEnPromptFromRaw(raw);
        if (prompt) break;
        const rawPlain = await callGeminiText({
          apiKey: geminiKey,
          system,
          userMessage: "변환해줘.",
          maxTokens: 256,
          model,
        });
        prompt = parseEnPromptFromRaw(rawPlain);
        if (prompt) break;
      } catch (e) {
        console.warn(`[scene-image] Gemini ${model}:`, (e as Error)?.message);
      }
    }
  }

  if (!prompt) {
    throw new Error("AI 응답에서 영어 프롬프트를 찾지 못했어요. 다시 시도해주세요.");
  }
  return prompt;
}

/** 요청마다 다른 seed로 다양성 확보 (같은 프롬프트도 다른 결과) */
function getRandomSeed(pananaId: string): number {
  const mix = `${pananaId}-${Date.now()}-${Math.random()}`;
  let h = 0;
  for (let i = 0; i < mix.length; i++) h = (Math.imul(31, h) + mix.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647;
}

const FAL_NEGATIVE_PROMPT_BASE =
  "passport photo, id photo, frontal portrait only, same pose, repetitive, illustration, cartoon, anime, drawing, painting, digital art, 3d render, cgi, stylized, artistic, comic, manga, bad quality, worst quality, text, signature, watermark, extra limbs, deformed, blurry, different outfit, changed clothes, different dress, different top, different shirt, different uniform, different hair, different hairstyle, different hair color, different colors, color change, suit, jacket, blazer, shirt, polo, wearing different";
const FAL_NEGATIVE_PROMPT_DIVERSITY =
  ", same pose as reference, same background, repeated composition, identical to previous";

async function callFalFluxPulid(
  referenceImageUrl: string,
  prompt: string,
  steps: number,
  pananaId: string,
  opts?: {
    extraNegative?: string;
    idWeight?: number;
    imageSize?: { width: number; height: number };
  }
): Promise<string | null> {
  const falKey = process.env.FAL_KEY || process.env.FAL_KEY_ID;
  if (!falKey) throw new Error("Missing FAL_KEY");
  const numSteps = Math.max(8, Math.min(20, Math.round(steps)));
  const seed = getRandomSeed(pananaId);
  const res = await fetch("https://fal.run/fal-ai/flux-pulid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      prompt,
      reference_image_url: referenceImageUrl,
      image_size: opts?.imageSize || { width: 1024, height: 768 },
      num_inference_steps: numSteps,
      seed,
      id_weight:
        typeof opts?.idWeight === "number"
          ? Math.max(0.6, Math.min(1.0, Number(opts.idWeight)))
          : 0.85,
      max_sequence_length: "256",
      negative_prompt:
        FAL_NEGATIVE_PROMPT_BASE +
        FAL_NEGATIVE_PROMPT_DIVERSITY +
        (opts?.extraNegative ? `, ${opts.extraNegative}` : ""),
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fal.ai error: ${res.status} ${err}`);
  }
  const data = (await res.json().catch(() => ({}))) as any;
  const images = data?.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const url = String(images[0]?.url || "").trim();
  return url || null;
}

const SCENE_BUCKET = "panana-scene-images";

async function uploadToSupabase(
  sb: SupabaseClient,
  pananaId: string,
  falImageUrl: string
): Promise<string> {
  const res = await fetch(falImageUrl);
  if (!res.ok) throw new Error(`Fal 이미지 fetch 실패: ${res.status}`);
  const inputBuf = Buffer.from(await res.arrayBuffer());

  const webpBuf = await sharp(inputBuf)
    .webp({ quality: 88, effort: 4 })
    .toBuffer();

  const path = `${pananaId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.webp`;
  const { error } = await sb.storage.from(SCENE_BUCKET).upload(path, webpBuf, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Supabase 업로드 실패: ${error.message}`);
  const { data } = sb.storage.from(SCENE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pananaId = searchParams.get("pananaId");
    if (!pananaId || !isUuid(pananaId)) {
      return NextResponse.json({ ok: false, error: "Invalid pananaId" }, { status: 400 });
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    const sbAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const settings = await getSceneImageSettings(sbAdmin);
    if (!settings.enabled) {
      return NextResponse.json({ ok: true, remaining: 0, dailyLimit: settings.dailyLimit });
    }
    const todayCount = await getTodayUsageCount(sbAdmin, pananaId);
    const remaining = Math.max(0, settings.dailyLimit - todayCount);
    return NextResponse.json({ ok: true, remaining, dailyLimit: settings.dailyLimit });
  } catch (e: any) {
    console.warn("[scene-image] GET fallback:", e?.message);
    return NextResponse.json({ ok: true, remaining: 5, dailyLimit: 5 });
  }
}

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const { pananaId, characterSlug, enPrompt, userMessage, assistantMessage, recentContext } = body;

    if (!isUuid(pananaId)) {
      return NextResponse.json({ ok: false, error: "Invalid pananaId" }, { status: 400 });
    }

    const characterData = await getCharacterData(characterSlug);
    if (!characterData.profileImageUrl) {
      return NextResponse.json(
        { ok: false, error: "캐릭터 프로필 이미지를 찾을 수 없어요." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    const sbAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const settings = await getSceneImageSettings(sbAdmin);
    if (!settings.enabled) {
      return NextResponse.json({ ok: false, error: "장면 이미지 기능이 비활성화되어 있어요." }, { status: 400 });
    }

    const visionCacheTtlMs = Math.max(0, settings.visionCacheMinutes) * 60 * 1000;
    const visionAppearance = await describeReferenceImage(characterData.profileImageUrl, visionCacheTtlMs);
    const appearance = visionAppearance
      ? characterData.appearance
        ? `${visionAppearance}. ${characterData.appearance}`
        : visionAppearance
      : characterData.appearance;

    const narrativeBlock = extractNarrativeFromMessage(String(assistantMessage ?? ""));
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    let resolvedPrompt = String(enPrompt || "").trim();
    if (!resolvedPrompt && userMessage != null && assistantMessage != null) {
      resolvedPrompt = await messageToEnPrompt(String(userMessage), String(assistantMessage), {
        characterName: characterData.name,
        appearance,
        roleOrSetting: characterData.roleOrSetting || undefined,
        worldSummary: characterData.worldSummary || undefined,
        recentContext: recentContext?.filter((m) => m?.role && m?.content),
        narrativeBlock: narrativeBlock || undefined,
      });
    }
    if (!resolvedPrompt) {
      return NextResponse.json({ ok: false, error: "enPrompt 또는 userMessage, assistantMessage가 필요해요." }, { status: 400 });
    }

    if (!process.env.FAL_KEY && !process.env.FAL_KEY_ID) {
      return NextResponse.json(
        { ok: false, error: "이미지 생성을 위해 FAL_KEY 환경 변수가 필요해요." },
        { status: 500 }
      );
    }

    const todayCount = await getTodayUsageCount(sbAdmin, pananaId);
    if (todayCount >= settings.dailyLimit) {
      return NextResponse.json(
        { ok: false, error: `오늘 장면 생성 횟수(${settings.dailyLimit}회)를 모두 사용했어요.` },
        { status: 400 }
      );
    }

    let differentiator = "";
    if (geminiKey && userMessage != null && assistantMessage != null) {
      try {
        differentiator = await getSceneDifferentiator(
          String(userMessage),
          String(assistantMessage),
          narrativeBlock,
          geminiKey
        );
      } catch (e) {
        console.warn("[scene-image] getSceneDifferentiator:", (e as Error)?.message);
      }
    }

    const forceFullBody = wantsFullBodyScene({
      userMessage,
      assistantMessage,
      narrativeBlock,
      recentContext,
    });
    const randomAngleShot = pickRandomAngleShot(forceFullBody);
    const variableBlock = [differentiator, randomAngleShot, resolvedPrompt].filter(Boolean).join(". ");
    const stylePrefix = "Photorealistic, realistic photograph, 8k photo, real person, natural lighting. ";
    const qualitySuffix = " Detailed, sharp, high quality.";
    const accessoryRule = "Accessories (brooch, scarf, pin, name tag, etc.): keep exactly as in reference; do not add any accessory not in the reference image. ";
    const fullBodyBlock = forceFullBody
      ? "(Extreme wide shot), (Full body shot:1.6), head-to-toe framing, visible feet, visible shoes, entire body fully inside frame, clear space above head and below feet, camera pulled back, no body crop."
      : "";
    const fixedBlock = appearance
      ? `${stylePrefix}Same exact outfit, same colors, same hairstyle as reference. ${accessoryRule}${appearance}. ${fullBodyBlock} [Scene and pose - do not change outfit, colors, or add/remove accessories] `
      : stylePrefix;
    const finalPrompt = fixedBlock + variableBlock + qualitySuffix;
    const fullBodyOpts = forceFullBody
      ? {
          idWeight: 0.74,
          imageSize: { width: 768, height: 1152 },
          extraNegative:
            "close up, portrait, selfie closeup, cropped, bust shot, upper body only, half body, torso shot, cropped feet, feet out of frame, head cut off, body cut off, seated portrait, waist-up",
        }
      : undefined;

    let falUrl = await callFalFluxPulid(
      characterData.profileImageUrl,
      finalPrompt,
      settings.steps,
      pananaId,
      fullBodyOpts
    );
    // 전신 요청인데 상반신으로 생성되면, 더 강한 구도 제약으로 1회 자동 재시도
    if (forceFullBody && falUrl && geminiKey) {
      const fullBodyOk = await isFullBodyImage({ imageUrl: falUrl, apiKey: geminiKey });
      if (!fullBodyOk) {
        const retryPrompt =
          `${finalPrompt} ` +
          "(MUST full body) head-to-toe standing pose, both feet and shoes clearly visible, full legs visible, camera much farther away, subject fully inside frame with margin above head and below feet, not cropped at any body part.";
        falUrl = await callFalFluxPulid(
          characterData.profileImageUrl,
          retryPrompt,
          settings.steps,
          pananaId,
          {
            idWeight: 0.68,
            imageSize: { width: 768, height: 1280 },
            extraNegative:
              "close up, portrait, selfie closeup, cropped, bust shot, upper body only, half body, torso shot, cropped feet, feet out of frame, head cut off, body cut off, seated portrait, waist-up, knee-up shot, medium shot",
          }
        );
      }
    }
    if (!falUrl) {
      return NextResponse.json({ ok: false, error: "이미지 생성에 실패했어요." }, { status: 500 });
    }

    let finalUrl: string;
    try {
      finalUrl = await uploadToSupabase(sbAdmin, pananaId, falUrl);
    } catch (uploadErr: any) {
      console.warn("[scene-image] Supabase 업로드 실패, Fal URL 반환:", uploadErr?.message);
      finalUrl = falUrl;
    }

    try {
      await logUsage(sbAdmin, pananaId, characterSlug);
    } catch (logErr: any) {
      console.warn("[scene-image] logUsage failed (panana_scene_image_log may not exist):", logErr?.message);
    }
    const remaining = settings.dailyLimit - todayCount - 1;

    return NextResponse.json({
      ok: true,
      url: finalUrl,
      quotaRemaining: Math.max(0, remaining),
      dailyLimit: settings.dailyLimit,
    });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }
    const msg = String(e?.message || "장면 이미지 생성에 실패했어요.");
    console.error("[scene-image]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
