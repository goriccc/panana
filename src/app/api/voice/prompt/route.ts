import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { filterLorebookRows } from "@/lib/studio/unlockEngine";
import { composeSystemPrompt } from "@/lib/voice/composePrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSupabase() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

async function loadPananaCharacterBySlug(slug: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("panana_public_characters_v")
    .select("slug, name, handle, hashtags, mbti, intro_title, intro_lines, mood_title, mood_lines, studio_character_id, gender")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function loadStudioPrompt(characterId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("character_prompts")
    .select("payload")
    .eq("character_id", characterId)
    .maybeSingle();
  if (error) throw error;
  return (data?.payload as any) || null;
}

async function loadStudioLorebook(characterId: string) {
  const supabase = getSupabase();
  const { data: cRow, error: cErr } = await supabase
    .from("characters")
    .select("id, project_id")
    .eq("id", characterId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!cRow?.project_id) return [];

  const { data, error } = await supabase
    .from("lorebook_entries")
    .select("key, value, sort_order, unlock_type, unlock_affection_min, unlock_expr, unlock_cost_panana, unlock_ending_key, unlock_ep_min, unlock_sku, active")
    .eq("project_id", cRow.project_id)
    .eq("scope", "character")
    .eq("character_id", characterId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as any[];
}

async function loadVoiceConfig() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("panana_voice_config")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (
    data ?? {
      voice_style_female: "warm",
      voice_style_male: "calm",
      voice_name_female: "Aoede",
      voice_name_male: "Fenrir",
      base_model: "gemini-2.5-flash-native-audio-preview-12-2025",
    }
  );
}

function styleInstruction(style: string): string {
  switch (style) {
    case "bright":
      return "말투: 밝고 경쾌하게. 문장은 짧게, 긍정적인 표현을 사용하되 과장하지 마세요.";
    case "firm":
      return "말투: 단호하고 명확하게. 핵심을 먼저 말하고, 불필요한 수식어를 줄이세요.";
    case "empathetic":
      return '말투: 공감적으로. 먼저 감정을 인정하고("그럴 수 있어요"), 그 다음 현실적인 조언을 제시하세요.';
    case "warm":
      return "말투: 다정하고 따뜻하게. 부드러운 표현과 배려하는 어조로 이야기하세요.";
    case "calm":
    default:
      return "말투: 차분하고 안정감 있게. 속도는 너무 빠르지 않게, 정리된 흐름으로 말하세요.";
  }
}

function pickVoiceByCharacterGender(
  characterGender: string | null | undefined,
  cfg: { voice_name_female?: string; voice_name_male?: string; voice_style_female?: string; voice_style_male?: string }
): { voiceName: string; voiceStyle: string } {
  const gender = String(characterGender || "female").trim().toLowerCase();
  const isMale = gender === "male";
  return {
    voiceName: isMale
      ? String(cfg?.voice_name_male || "Fenrir").trim() || "Fenrir"
      : String(cfg?.voice_name_female || "Aoede").trim() || "Aoede",
    voiceStyle: isMale
      ? String(cfg?.voice_style_male || "calm").trim() || "calm"
      : String(cfg?.voice_style_female || "warm").trim() || "warm",
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterSlug = url.searchParams.get("characterSlug")?.trim();
    const callSign = url.searchParams.get("callSign")?.trim() || "";
    const runtimeJson = url.searchParams.get("runtime"); // JSON: { variables, ownedSkus, ending }

    if (!characterSlug) {
      return NextResponse.json({ ok: false, error: "characterSlug 필요" }, { status: 400 });
    }

    const panana = await loadPananaCharacterBySlug(characterSlug);
    if (!panana) {
      return NextResponse.json({ ok: false, error: "캐릭터를 찾을 수 없어요." }, { status: 404 });
    }

    const studioId = (panana as any)?.studio_character_id || null;
    let studioPrompt: any = null;
    let studioLorebook: any[] = [];

    if (studioId) {
      [studioPrompt, studioLorebook] = await Promise.all([
        loadStudioPrompt(studioId),
        loadStudioLorebook(studioId),
      ]);
    }

    const runtime = runtimeJson ? (JSON.parse(runtimeJson) as any) : undefined;
    const filteredLorebook = filterLorebookRows(studioLorebook, runtime).filter((x: any) => x?.active !== false);

    const baseSystem = composeSystemPrompt({
      panana: panana as any,
      studioPrompt,
      studioLorebook: filteredLorebook,
      callSign: callSign || undefined,
      forVoice: true,
    });

    const voiceConfig = await loadVoiceConfig();
    const characterGender = (panana as any)?.gender;
    const { voiceName, voiceStyle } = pickVoiceByCharacterGender(characterGender, voiceConfig);
    const styleText = styleInstruction(voiceStyle);

    const systemPrompt = `${baseSystem}\n\n[음성 대화 - 필수]\n- **절대 지문을 만들지 않고, 절대 읽지 않는다.**\n- 금지 범위: 괄호(), （）, 대괄호[], 중괄호{}, 인용 괄호「」/『』, 별표지문(*웃음*), 밑줄지문(_한숨_)\n- 금지 토큰 자체를 출력하지 않는다: (, ), （, ）, [, ], {, }, 「, 」, 『, 』, *, _\n- 출력 형식 계약: **오직 발화 대사만 평문으로 출력**한다. 지문/서술/메타 설명/연출문은 전부 금지.\n- 문장 습관 규칙: 행동을 설명하는 진행형 서술(\"...하며\", \"...하면서\", \"웃으며\", \"한숨\")을 쓰지 않는다.\n- 발화 직전 자체 검증(필수):\n  1) 금지 토큰 또는 지문 패턴이 있으면 전부 제거\n  2) 제거 후 대사만 남기고 다시 한 문장으로 재작성\n  3) 결과는 대사만 포함한 평문으로 출력\n- ${styleText}\n- 음성으로 자연스럽게 대화한다. 짧은 문장 위주로 말한다.`;

    const groqVoiceEnabled = Boolean((voiceConfig as any)?.groq_voice_enabled);
    const groqModel = (voiceConfig as any)?.groq_model && String((voiceConfig as any).groq_model).trim()
      ? String((voiceConfig as any).groq_model).trim()
      : "grok-voice-1";
    const groqVoice =
      (voiceConfig as any)?.groq_voice && ["Ara", "Rex", "Sal", "Eve", "Leo"].includes(String((voiceConfig as any).groq_voice).trim())
        ? String((voiceConfig as any).groq_voice).trim()
        : "Ara";
    const groqTemperature =
      (voiceConfig as any)?.groq_temperature != null && Number.isFinite(Number((voiceConfig as any).groq_temperature))
        ? Number((voiceConfig as any).groq_temperature)
        : null;
    const groqNaturalKorean = (voiceConfig as any)?.groq_natural_korean !== false;

    return NextResponse.json({
      ok: true,
      systemPrompt,
      voiceConfig: {
        voice_name: voiceName,
        voice_style: voiceStyle,
        base_model: voiceConfig.base_model ?? "gemini-2.5-flash-native-audio-preview-12-2025",
        groq_voice_enabled: groqVoiceEnabled,
        groq_model: groqVoiceEnabled ? groqModel : null,
        groq_voice: groqVoiceEnabled ? groqVoice : null,
        groq_temperature: groqVoiceEnabled ? groqTemperature : null,
        groq_natural_korean: groqVoiceEnabled ? groqNaturalKorean : null,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
