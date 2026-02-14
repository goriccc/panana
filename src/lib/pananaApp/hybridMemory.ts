/**
 * Hybrid Memory: 단기(최근 N턴) + 장기 요약 + 유저 프로필
 * - 장기 요약: 대화를 감정 위주 3인칭 요약으로 누적 (panana_memory_summaries)
 * - 유저 프로필: 이름/직업/호불호/고민 등 추출 (panana_memory_profile)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const SUMMARY_EVERY_N_USER_TURNS = 20;
const RECENT_TURNS_FOR_LLM = 20;

export type MemoryMessage = { role: "user" | "assistant"; content: string };

export interface LoadedMemory {
  profileBlock: string;
  summariesBlock: string;
}

/**
 * DB에서 [유저 프로필] + [지난 서사] 블록 문자열 로드
 */
export async function loadMemory(
  sb: SupabaseClient<any>,
  userId: string,
  characterSlug: string
): Promise<LoadedMemory | null> {
  const slug = String(characterSlug || "").trim().toLowerCase();
  if (!userId || !slug) return null;

  const [profileRes, summariesRes] = await Promise.all([
    sb.from("panana_memory_profile").select("profile_json").eq("user_id", userId).eq("character_slug", slug).maybeSingle(),
    sb
      .from("panana_memory_summaries")
      .select("summary_text, created_at")
      .eq("user_id", userId)
      .eq("character_slug", slug)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  const profile = (profileRes?.data as any)?.profile_json;
  const summaries = (summariesRes?.data || []) as { summary_text: string; created_at?: string }[];

  const profileEntries: string[] = [];
  if (profile && typeof profile === "object") {
    for (const [k, v] of Object.entries(profile)) {
      if (v != null && String(v).trim()) profileEntries.push(`- ${k}: ${String(v).trim()}`);
    }
  }
  const profileBlock = profileEntries.length ? `# [유저 프로필]\n${profileEntries.join("\n")}` : "";
  const summariesBlock =
    summaries.length > 0
      ? `# [우리의 지난 서사]\n${summaries.map((s, i) => `- 챕터${i + 1}: ${String(s.summary_text || "").trim()}`).filter(Boolean).join("\n")}`
      : "";

  if (!profileBlock && !summariesBlock) return null;
  return { profileBlock, summariesBlock };
}

/**
 * 최근 N턴만 남기기 (메시지 배열에서 user/assistant 쌍 기준)
 */
export function takeLastNTurns(messages: MemoryMessage[], n: number): MemoryMessage[] {
  const turns: MemoryMessage[] = [];
  let i = messages.length - 1;
  while (i >= 0 && turns.length < n * 2) {
    const m = messages[i];
    if (m?.role === "user" || m?.role === "assistant") {
      turns.unshift(m);
    }
    i--;
  }
  return turns;
}

/**
 * 메시지 배열에서 user 턴 개수
 */
export function countUserTurns(messages: MemoryMessage[]): number {
  return messages.filter((m) => m?.role === "user").length;
}

/**
 * Gemini로 최근 대화를 감정 위주 3인칭 요약
 */
export async function summarizeWithGemini(
  apiKey: string,
  messages: MemoryMessage[]
): Promise<string> {
  const dialog = messages
    .map((m) => `${m.role === "user" ? "유저" : "캐릭터"}: ${String(m.content || "").trim()}`)
    .join("\n");
  const system =
    "당신은 대화 요약자입니다. 주어진 대화를 3인칭 시점, 감정 위주로 2~4문장으로 요약하세요. " +
    "예: '유저는 오늘 상사에게 깨져서 우울해하며 매운 떡볶이를 먹었다. 캐릭터는 그를 위로해주었다.' " +
    "요약만 출력하고 설명은 하지 마세요.";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: `대화:\n${dialog}` }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 512, responseMimeType: "text/plain" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: any) => p?.text).filter(Boolean).join("\n").trim() : "";
  return text || "";
}

/**
 * Gemini로 대화에서 유저 프로필(이름, 직업, 호불호, 고민 등) 추출 → JSON
 */
export async function extractProfileWithGemini(
  apiKey: string,
  messages: MemoryMessage[]
): Promise<Record<string, string>> {
  const dialog = messages
    .slice(-60)
    .map((m) => `${m.role === "user" ? "유저" : "캐릭터"}: ${String(m.content || "").trim()}`)
    .join("\n");
  const system =
    "대화에서 유저(사용자)에 대한 정보만 추출하세요. 다음 키만 사용하고, 없으면 넣지 마세요. " +
    "키: user_name, job, pet, like, dislike, current_worry, relationship, habit, nickname 등. " +
    "한국어 값으로만 출력. 반드시 JSON 객체 한 개만 출력하고 다른 글은 금지. 예: {\"user_name\":\"민수\",\"pet\":\"고양이(나비)\"}";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: `대화:\n${dialog}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: "application/json" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  const parts = data?.candidates?.[0]?.content?.parts;
  const raw = Array.isArray(parts) ? parts.map((p: any) => p?.text).filter(Boolean).join("").trim() : "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v != null && typeof v === "string" && v.trim()) out[String(k)] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * 요약 필요 여부: 마지막 요약 이후 user 턴이 SUMMARY_EVERY_N_USER_TURNS 이상인지
 */
export async function getLastSummaryTurnCount(
  sb: SupabaseClient<any>,
  userId: string,
  characterSlug: string
): Promise<number> {
  const { data } = await sb
    .from("panana_memory_summaries")
    .select("user_turn_count")
    .eq("user_id", userId)
    .eq("character_slug", characterSlug)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number((data as any)?.user_turn_count) || 0;
}

/**
 * 응답 후 메모리 업데이트: 20턴마다 요약 추가, 프로필 추출·병합
 * @param totalUserTurnsOptional 클라이언트가 보낸 해당 스레드 전체 유저 턴 수(있으면 요약 시 누적 기준으로 사용)
 */
export async function updateMemory(
  sb: SupabaseClient<any>,
  userId: string,
  characterSlug: string,
  messages: MemoryMessage[],
  geminiApiKey: string,
  totalUserTurnsOptional?: number
): Promise<void> {
  const slug = String(characterSlug || "").trim().toLowerCase();
  if (!userId || !slug || !geminiApiKey) return;

  const lastCount = await getLastSummaryTurnCount(sb, userId, slug);
  const userTurnsInPayload = countUserTurns(messages);
  const totalUserTurns = Math.max(
    lastCount,
    typeof totalUserTurnsOptional === "number" ? totalUserTurnsOptional : userTurnsInPayload
  );
  const turnsSinceSummary = totalUserTurns - lastCount;

  if (turnsSinceSummary >= SUMMARY_EVERY_N_USER_TURNS) {
    const toSummarize = takeLastNTurns(messages, SUMMARY_EVERY_N_USER_TURNS);
    const summaryText = await summarizeWithGemini(geminiApiKey, toSummarize);
    if (summaryText) {
      await sb.from("panana_memory_summaries").insert({
        user_id: userId,
        character_slug: slug,
        summary_text: summaryText,
        user_turn_count: totalUserTurns,
      } as any);
    }
  }

  const extracted = await extractProfileWithGemini(geminiApiKey, messages);
  if (Object.keys(extracted).length === 0) return;

  const { data: existing } = await sb
    .from("panana_memory_profile")
    .select("profile_json")
    .eq("user_id", userId)
    .eq("character_slug", slug)
    .maybeSingle();
  const current = (existing as any)?.profile_json || {};
  const merged = { ...(typeof current === "object" ? current : {}), ...extracted };
  await sb
    .from("panana_memory_profile")
    .upsert(
      { user_id: userId, character_slug: slug, profile_json: merged, updated_at: new Date().toISOString() } as any,
      { onConflict: "user_id,character_slug" }
    );
}

export { SUMMARY_EVERY_N_USER_TURNS, RECENT_TURNS_FOR_LLM };
