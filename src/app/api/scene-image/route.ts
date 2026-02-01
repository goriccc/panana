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
    const { data, error } = await sb
      .from("panana_public_site_settings_v")
      .select("scene_image_enabled, scene_image_daily_limit, scene_image_model, scene_image_steps, scene_image_vision_cache_minutes")
      .limit(1)
      .maybeSingle();
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

async function logUsage(sb: SupabaseClient<any>, pananaId: string) {
  await sb.from("panana_scene_image_log").insert({ panana_id: pananaId } as any);
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

  const sys = `You are an expert at describing character appearance for AI image generation. Your description will be used to recreate the EXACT same outfit in generated images.

MANDATORY checklist - include ALL that are visible:
1. HAIR: exact color, length, style (straight/wavy/curly), parting, bangs, accessories
2. OUTFIT - EVERY visible element:
   - Top: color, fabric, neckline, sleeves, collar, patterns
   - Bottom if visible: color, length, fabric
   - Accessories: jewelry, scarf, belt, hat
   - Layers: cardigan/jacket/vest - colors and styles
3. DISTINGUISHING: glasses, makeup, skin tone

Output as one dense paragraph. No preamble. Be exhaustive - every detail matters for consistency.`;

  try {
    const raw = await callGeminiVision({
      apiKey,
      system: sys,
      text: "Describe hair and outfit in maximum detail. Use the MANDATORY checklist. Include every visible element: colors, fabrics, neckline, sleeves, accessories, patterns. Output will recreate this exact look - consistency is critical.",
      base64,
      mimeType: mediaType,
      maxTokens: 512,
    });
    const desc = String(raw || "").trim().slice(0, 600);
    if (desc) {
      visionAppearanceCache.set(imageUrl, { desc, ts: Date.now() });
      return desc;
    }
  } catch (e) {
    console.warn("[scene-image] describeReferenceImage:", (e as Error)?.message);
  }
  return "";
}

async function getCharacterData(slug: string): Promise<{
  profileImageUrl: string | null;
  name: string;
  appearance: string;
}> {
  const supabase = getSupabaseAnon();
  const { data: charData, error: charErr } = await supabase
    .from("panana_public_characters_v")
    .select("profile_image_url, name, studio_character_id, intro_lines")
    .eq("slug", slug)
    .maybeSingle();
  if (charErr || !charData) {
    return { profileImageUrl: null, name: "", appearance: "" };
  }
  const profileImageUrl = String((charData as any)?.profile_image_url || "").trim() || null;
  const name = String((charData as any)?.name || "").trim() || "캐릭터";
  const studioCharacterId = (charData as any)?.studio_character_id;
  const introLines = (charData as any)?.intro_lines as string[] | undefined;

  let appearance = "";
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
      }
    } catch {
      /* studio tables may be inaccessible, fallback to intro_lines */
    }
  }
  if (!appearance && Array.isArray(introLines) && introLines.length > 0) {
    appearance = introLines.slice(0, 2).join(" ").trim();
  }
  return { profileImageUrl, name, appearance };
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
  opts: { characterName?: string; appearance?: string; recentContext?: { role: string; content: string }[] }
): Promise<string> {
  const appearanceHint = opts.appearance
    ? `\n[캐릭터 고정 정보 - 반드시 100% 유지] ${String(opts.appearance).slice(0, 500)}`
    : "";
  const ctxLines =
    opts.recentContext && opts.recentContext.length > 0
      ? "\n[최근 대화 맥락 - 장소·소품 추출용]\n" +
        opts.recentContext
          .slice(-6)
          .map((m) => `[${m.role}] ${String(m.content || "").slice(0, 300)}`)
          .join("\n")
      : "";
  const system = `당신은 대화 장면을 Flux 이미지 생성용 영어 프롬프트로 변환합니다.
[유저] ${String(userMessage || "").slice(0, 500)}
[챗봇] ${String(assistantMessage || "").slice(0, 1500)}${appearanceHint}${ctxLines}

반드시 포함 (MANDATORY checklist):
1. OUTFIT/HAIR: [캐릭터 고정 정보]가 있으면 그대로 100% 포함. 헤어·의상 절대 변경 금지. 참조 이미지와 동일하게 유지.
2. LOCATION/PROPS: 최근 대화에서 언급된 장소(갤러리, 와인바 등), 소품(와인잔, 유화, 테이블 등)을 영어로 추출해 프롬프트 앞부분에 포함. 동일 장면이면 동일 표현 유지.
3. EXPRESSION/ACTION: 괄호() 지문의 표정·동작·감정을 영어로 포함. 예: "입을 벌려 하얗게 웃는다" → "smiling brightly", "고개를 기울인다" → "tilting her head".
4. SHOT: full body, medium shot, close-up 중 장면에 맞게 선택.
5. QUALITY: detailed, sharp, high quality 추가. (출력 1024x768이므로 4k/cinematic 제외)

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
          userMessage: "변환해줘. MANDATORY checklist 모두 포함. enPrompt 100단어 이상 상세히.",
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

async function callFalFluxPulid(
  referenceImageUrl: string,
  prompt: string,
  steps: number
): Promise<string | null> {
  const falKey = process.env.FAL_KEY || process.env.FAL_KEY_ID;
  if (!falKey) throw new Error("Missing FAL_KEY");
  const numSteps = Math.max(8, Math.min(20, Math.round(steps)));
  const res = await fetch("https://fal.run/fal-ai/flux-pulid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      prompt,
      reference_image_url: referenceImageUrl,
      image_size: { width: 1024, height: 768 },
      num_inference_steps: numSteps,
      max_sequence_length: "256",
      negative_prompt:
        "bad quality, worst quality, text, signature, watermark, extra limbs, deformed, blurry, different outfit, changed clothes, different hair, different hairstyle, suit, jacket, blazer, shirt, polo",
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

    let resolvedPrompt = String(enPrompt || "").trim();
    if (!resolvedPrompt && userMessage != null && assistantMessage != null) {
      resolvedPrompt = await messageToEnPrompt(String(userMessage), String(assistantMessage), {
        characterName: characterData.name,
        appearance,
        recentContext: recentContext?.filter((m) => m?.role && m?.content),
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

    const finalPrompt = appearance
      ? `${appearance}. ${resolvedPrompt}`
      : resolvedPrompt;
    const falUrl = await callFalFluxPulid(
      characterData.profileImageUrl,
      finalPrompt,
      settings.steps
    );
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
      await logUsage(sbAdmin, pananaId);
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
