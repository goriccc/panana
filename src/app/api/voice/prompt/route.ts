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

function getSupabaseAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
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

/** 음성 보이스 선택용: admin에서 설정한 성별을 panana_characters에서 서비스 롤로 직접 조회 (뷰/권한 이슈 회피) */
async function loadCharacterGenderBySlug(slug: string): Promise<"male" | "female" | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("panana_characters")
      .select("gender")
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle();
    if (error) return null;
    return normalizeCharacterGender((data as any)?.gender ?? null);
  } catch {
    return null;
  }
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

/** API/DB에서 오는 값을 "male" | "female" | null 로 정규화 (대소문자·공백 무관) */
function normalizeCharacterGender(
  raw: string | null | undefined
): "male" | "female" | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "male") return "male";
  if (s === "female") return "female";
  return null;
}

function pickVoiceByCharacterGender(
  characterGender: string | null | undefined,
  cfg: { voice_name_female?: string; voice_name_male?: string; voice_style_female?: string; voice_style_male?: string }
): { voiceName: string; voiceStyle: string } {
  const gender = normalizeCharacterGender(characterGender);
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

/**
 * 음성 통화 프롬프트. Gemini Live ~10분 연결 한계 대비:
 * - 전략 A: 클라이언트가 goAway 수신 시 선제 재연결 + recentChat으로 맥락 전달 (현재 구현).
 * - 전략 B: 장기 통화 시 voiceSummary로 이전 구간 요약 주입 가능 (voiceSummary 파라미터).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const characterSlug = url.searchParams.get("characterSlug")?.trim();
    const callSign = url.searchParams.get("callSign")?.trim() || "";
    const runtimeJson = url.searchParams.get("runtime"); // JSON: { variables, ownedSkus, ending }
    const recentChatJson = url.searchParams.get("recentChat"); // JSON: [{ from: "user"|"bot", text: string }]
    const voiceReconnect = url.searchParams.get("voiceReconnect") === "1"; // 통화 재연결: Gemini Live 단일 연결 ~10분 한계 → goAway 60초 전 수신 시 클라이언트가 선제 재연결, recentChat으로 맥락 유지
    const voiceSummary = url.searchParams.get("voiceSummary")?.trim() || null; // 재연결 시 주입할 이전 통화 요약(전략 B: 장기 통화 시 3줄 요약으로 토큰 절약)

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
    // 캐릭터 성별: admin/characters에서 설정한 값을 쓰기 위해 panana_characters를 서비스 롤로 직접 조회 (뷰/권한 이슈 회피)
    let characterGender = await loadCharacterGenderBySlug(characterSlug!);
    if (characterGender === null) {
      characterGender = normalizeCharacterGender(
        (panana as any)?.gender ?? (panana as any)?.Gender ?? null
      );
    }
    const { voiceName, voiceStyle } = pickVoiceByCharacterGender(characterGender, voiceConfig);
    const styleText = styleInstruction(voiceStyle);
    const userDisplayName = callSign && String(callSign).trim() ? String(callSign).trim() : "상대";
    const isMale = characterGender === "male";
    const firstGreetingGuide = isMale
      ? `남성 캐릭터 예시: "여보세요?", "오~ ${userDisplayName}, 안녕 오랜만이야", "어 ${userDisplayName}이야? 잘 지냈어?" 등`
      : `여성 캐릭터 예시: "여보세요?", "어머 ${userDisplayName}, 안녕 오랜만이야", "어 ${userDisplayName}이야? 잘 지냈어?" 등`;

    let recentChatBlock = "";
    let reconnectContinuationBlock = "";
    try {
      if (recentChatJson && recentChatJson.trim()) {
        const recent = JSON.parse(recentChatJson) as Array<{ from?: string; text?: string }>;
        if (Array.isArray(recent) && recent.length > 0) {
          const maxLines = voiceReconnect ? 30 : 10;
          const maxTextLen = voiceReconnect ? 300 : 200;
          const lines = recent
            .slice(-maxLines)
            .map((m) => {
              const from = m.from === "user" ? "USER" : "ASSISTANT";
              const text = String(m.text ?? "").trim().slice(0, maxTextLen);
              return text ? `${from}: ${text}` : null;
            })
            .filter(Boolean);
          if (lines.length) {
            if (voiceReconnect) {
              const summaryBlock = voiceSummary
                ? `\n[이전 통화 요약]\n${voiceSummary}\n`
                : "";
              reconnectContinuationBlock = `${summaryBlock}\n[통화 재연결 - 지금까지 통화 내용]\n${lines.join("\n")}\n위는 이번 통화에서 지금까지 나온 대화이다. 연결이 잠시 끊겼다가 재연결된 상황이므로, **긴 재인사나 "다시 연결됐어" 같은 말은 하지 말고** 곧바로 대화를 이어가라. 맥락에 맞게 자연스럽게 다음 말을 한다.`;
            } else {
              recentChatBlock = `\n[최근 채팅 맥락 - 이 인사말에 반영할 것]\n${lines.join("\n")}\n위 대화를 참고해, 관계·맥락에 맞는 자연스러운 인사말을 한다.`;
            }
          }
        }
      }
    } catch {
      /* ignore */
    }

    const firstGreetingBlock = voiceReconnect
      ? `[통화 재연결 시 - 필수] 통화가 일시 끊겼다가 다시 연결된 상황이다. 너가 **먼저 말**해서 대화를 이어간다.${reconnectContinuationBlock} 새 인사나 "연결됐어" 같은 말 없이, 맥락상 이어질 한두 문장으로만 말한다.`
      : `[통화 연결 시 - 필수] 지금 ${userDisplayName}이(가) 나한테 전화를 걸었고, 내가 전화를 받은 상황이다. 통화가 연결되면 **반드시 너가 먼저 인사**한다. 상대 이름은 "${userDisplayName}"이다. ${firstGreetingGuide} 절대로 "내가 전화했어", "나 전화했잖아", "전화 올 줄 알았어", "전화 기다리고 있었어" 등 내가 전화를 건 것처럼 들리는 표현은 사용하지 않는다.
- **첫 인사는 2~4문장 정도로 조금 길어도 된다.** 캐릭터의 **세계관·로어북·성격·관계 설정**을 살려 말하고, 상황에 맞으면 감정이나 배경을 짧게 담아도 된다.
- 이전 대화 맥락이 아래에 주어지면 그에 맞는 인사말을 한다.${recentChatBlock}
- 링톤이 끝나고 연결된 직후 첫 발화는 이 인사로 시작한다. 이후 대화는 짧은 문장 위주로 말한다.`;

    const systemPrompt = `${baseSystem}\n\n[음성 대화 - 필수]\n- ${firstGreetingBlock}\n- **절대 지문을 만들지 않고, 절대 읽지 않는다.**\n- 금지 범위: 괄호(), （）, 대괄호[], 중괄호{}, 인용 괄호「」/『』, 별표지문(*웃음*), 밑줄지문(_한숨_)\n- 금지 토큰 자체를 출력하지 않는다: (, ), （, ）, [, ], {, }, 「, 」, 『, 』, *, _\n- 출력 형식 계약: **오직 발화 대사만 평문으로 출력**한다. 지문/서술/메타 설명/연출문은 전부 금지.\n- 문장 습관 규칙: 행동을 설명하는 진행형 서술(\"...하며\", \"...하면서\", \"웃으며\", \"한숨\")을 쓰지 않는다.\n- 발화 직전 자체 검증(필수):\n  1) 금지 토큰 또는 지문 패턴이 있으면 전부 제거\n  2) 제거 후 대사만 남기고 다시 한 문장으로 재작성\n  3) 결과는 대사만 포함한 평문으로 출력\n- ${styleText}\n- 음성으로 자연스럽게 대화한다. **통화 연결 직후 첫 인사만** 2~4문장으로 세계관을 담아 말해도 되고, 이후에는 짧은 문장 위주로 말한다.`;

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
