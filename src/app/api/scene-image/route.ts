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

async function describeReferenceImage(imageUrl: string, cacheTtlMs: number): Promise<string> {
  const cached = visionAppearanceCache.get(imageUrl);
  if (cached && cacheTtlMs > 0 && Date.now() - cached.ts < cacheTtlMs) return cached.desc;

  const apiKey = process.env.ANTHROPIC_API_KEY;
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

  const sys = `You are an assistant that describes character appearance for AI image generation.
Given the reference image (character thumbnail), output ONLY a short English description of:
1. Hair: color, length, style (e.g. "long straight dark brown hair, parted in the middle")
2. Outfit: color, type, neckline, sleeves (e.g. "light beige sleeveless cowl neck top with thin straps")

Be specific. Output one line, comma-separated. No preamble.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 128,
        system: sys,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image" as const,
                source: { type: "base64" as const, media_type: mediaType, data: base64 },
              },
              {
                type: "text" as const,
                text: "Describe hair and outfit only.",
              },
            ],
          },
        ],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return "";

    const raw = Array.isArray(data?.content)
      ? (data.content as any[]).map((c: any) => c?.text).filter(Boolean).join("\n")
      : "";
    const desc = String(raw || "").trim().slice(0, 200);
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

async function messageToEnPrompt(
  userMessage: string,
  assistantMessage: string,
  opts: { characterName?: string; appearance?: string; recentContext?: { role: string; content: string }[] }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY가 설정되어 있지 않아요.");
  }
  const appearanceHint = opts.appearance
    ? `\n[캐릭터 고정 정보 - 반드시 유지] ${String(opts.appearance).slice(0, 400)}`
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

규칙:
1. [캐릭터 고정 정보]가 있으면 반드시 그대로 포함. 헤어/의상 절대 변경 금지.
2. 참조 이미지(프로필 썸네일)와 동일한 의상·헤어·외형을 유지. 다른 옷/스타일로 바꾸지 마세요.
3. 괄호() 안 지문(표정·동작·감정)은 반드시 영어로 포함. 예: "입을 벌려 하얗게 웃는다" → "smiling brightly", "고개를 기울인다" → "tilting her head". 표정/동작은 장면 묘사를 따름.
4. 장소·소품·배경 일관성: 최근 대화에서 언급된 장소(갤러리, 와인바 등), 소품(와인잔, 유화, 테이블 등), 조명·분위기를 반드시 영어로 추출해 프롬프트 앞부분에 포함. 동일 장면이면 동일 표현 유지.
5. 장면/분위기/포즈·표정을 추가하고, 헤어·의상만 고정 정보와 동일하게 기술.
6. 장면에 맞는 샷 구도 선택. (full body, medium shot, close-up 등)
7. cinematic, 4k, detailed 퀄리티 키워드 추가.
다음 JSON만 출력: {"enPrompt": "영어 프롬프트"}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      temperature: 0.2,
      max_tokens: 256,
      system,
      messages: [{ role: "user", content: "변환해줘." }],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const errMsg = (data?.error as any)?.message || (data as any)?.message || "";
    const hint = res.status === 401 ? "API 키를 확인해주세요." : res.status === 429 ? "잠시 후 다시 시도해주세요." : "";
    throw new Error(`Anthropic API 오류 (${res.status})${errMsg ? `: ${errMsg}` : ""} ${hint}`.trim());
  }
  const raw = Array.isArray(data?.content)
    ? (data.content as any[]).map((c: any) => c?.text).filter(Boolean).join("\n")
    : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[scene-image] No JSON in Anthropic response, raw:", raw?.slice(0, 300));
    throw new Error("AI 응답에서 영어 프롬프트를 찾지 못했어요. 다시 시도해주세요.");
  }
  let parsed: { enPrompt?: string };
  try {
    parsed = JSON.parse(jsonMatch[0]) as { enPrompt?: string };
  } catch {
    throw new Error("AI 응답 형식이 올바르지 않아요. 다시 시도해주세요.");
  }
  const prompt = String(parsed?.enPrompt || "").trim();
  if (!prompt) {
    throw new Error("AI가 빈 프롬프트를 반환했어요. 다시 시도해주세요.");
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
