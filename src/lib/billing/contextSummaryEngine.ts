/**
 * 자동 요약 및 컨텍스트 관리 (Sliding Window).
 * - 15턴 초과 또는 컨텍스트 토큰이 예산의 80% 초과 시 트리거.
 * - Flash로 핵심 줄거리/관계 진척도/주요 키워드 300 토큰 이내 압축.
 * - 오래된 10턴을 요약본으로 대체해 Current Context로 주입.
 */

import type { MemoryMessage } from "@/lib/pananaApp/hybridMemory";
import {
  SUMMARY_TRIGGER_TURNS,
  SUMMARY_TRIGGER_TOKEN_RATIO,
  SUMMARY_MAX_TOKENS,
  ARCHIVE_TURNS_ON_SUMMARY,
  TOKEN_BUDGET_PER_TURN,
} from "./constants";
import type { ChatModelId } from "./types";

/** 대략적인 토큰 수 추정 (한글 기준: 문자 수 / 2 정도) */
export function estimateTokens(text: string): number {
  if (!text || !text.trim()) return 0;
  return Math.ceil(String(text).replace(/\s/g, "").length / 2) + Math.ceil(String(text).split(/\s/).length * 0.4);
}

/** 트리거 여부: user 턴 > 15 또는 누적 토큰 > 예산의 80% */
export function shouldTriggerSummary(
  userTurnCount: number,
  modelId: ChatModelId,
  estimatedContextTokens: number
): boolean {
  if (userTurnCount > SUMMARY_TRIGGER_TURNS) return true;
  const budget = TOKEN_BUDGET_PER_TURN[modelId] ?? 2000;
  const threshold = Math.floor(budget * SUMMARY_TRIGGER_TOKEN_RATIO);
  return estimatedContextTokens >= threshold;
}

/** 요약할 메시지에서 가장 오래된 N턴 추출 */
export function takeOldestTurns(messages: MemoryMessage[], n: number): MemoryMessage[] {
  const out: MemoryMessage[] = [];
  let turns = 0;
  for (let i = 0; i < messages.length && turns < n; i++) {
    const m = messages[i];
    if (m?.role === "user" || m?.role === "assistant") {
      out.push(m);
      if (m.role === "user") turns++;
    }
  }
  return out;
}

/** 요약 후 남길 최신 메시지 (오래된 archiveTurns 턴 제외) */
export function dropOldestTurns(messages: MemoryMessage[], archiveTurns: number): MemoryMessage[] {
  let skipTurns = archiveTurns;
  let i = 0;
  for (; i < messages.length && skipTurns > 0; i++) {
    const m = messages[i];
    if (m?.role === "user") skipTurns--;
  }
  return messages.slice(i);
}

/**
 * Flash로 [핵심 줄거리, 관계 진척도, 주요 키워드] 300 토큰 이내 압축.
 */
export async function summarizeContextWithFlash(
  apiKey: string,
  messages: MemoryMessage[]
): Promise<string> {
  const dialog = messages
    .map((m) => `${m.role === "user" ? "유저" : "캐릭터"}: ${String(m.content || "").trim().slice(0, 500)}`)
    .join("\n");
  const system =
    "당신은 대화 요약자입니다. 주어진 대화를 다음 세 가지를 포함해 300 토큰(한글 기준 약 150자~200자) 이내로 압축하세요: " +
    "(1) 핵심 줄거리 (2) 관계 진척도 (3) 주요 키워드. " +
    "요약만 출력하고 설명은 하지 마세요. 문단 구분 없이 이어서 쓰세요.";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: `대화:\n${dialog}` }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: SUMMARY_MAX_TOKENS,
        responseMimeType: "text/plain",
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: any) => p?.text).filter(Boolean).join("\n").trim() : "";
  return text || "";
}
