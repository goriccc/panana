/**
 * 채팅 API용 P/토큰 매핑 (provider + model 문자열 → ChatModelId, max_tokens, 원가).
 */

import type { ChatModelId } from "./types";
import { MAX_TOKENS_PER_TURN, P_PER_TURN } from "./constants";
import { getChatPForTurn } from "./computeP";

/** API 모델 문자열 → ChatModelId (없으면 null) */
export function getChatModelIdFromApi(provider: string, model: string): ChatModelId | null {
  const p = String(provider || "").toLowerCase();
  const m = String(model || "").toLowerCase();
  if (p === "anthropic") {
    if (m.includes("haiku")) return "claude_haiku";
    if (m.includes("sonnet")) return "claude_sonnet";
    return "claude_sonnet";
  }
  if (p === "gemini") {
    if (m.includes("flash")) return "gemini_flash";
    if (m.includes("pro")) return "gemini_pro";
    return "gemini_pro";
  }
  if (p === "deepseek") return "claude_haiku";
  return null;
}

/** 1턴당 최대 토큰 (모델별 한도) */
export function getMaxTokensForModel(modelId: ChatModelId | null): number {
  if (!modelId) return 1024;
  return MAX_TOKENS_PER_TURN[modelId] ?? 1024;
}

/** 목표 회당 원가 (환율 1,450원 기준, 원 단위) — 마진 로깅용 */
export const COST_PER_MODEL_KRW: Record<ChatModelId, number> = {
  claude_haiku: 4,
  claude_sonnet: 12,
  gemini_flash: 2,
  gemini_pro: 8,
};

/** 소모 토큰 * 실시간 환율 단가 → 원가 (간이: 토큰당 단가 = 목표 1턴 원가 / 1턴 예산 토큰) */
export function estimateCostKrw(
  modelId: ChatModelId,
  inputTokens: number,
  outputTokens: number
): number {
  const budget = MAX_TOKENS_PER_TURN[modelId] ?? 2000;
  const costPerTurn = COST_PER_MODEL_KRW[modelId] ?? 8;
  const costPerToken = costPerTurn / budget;
  return (inputTokens + outputTokens) * costPerToken;
}

/** 마진 로깅: P 매출 대비 원가 비율 */
export function logMarginGuard(
  modelId: ChatModelId,
  pCharged: number,
  inputTokens: number,
  outputTokens: number,
  meta?: { characterSlug?: string; userId?: string }
): void {
  const costKrw = estimateCostKrw(modelId, inputTokens, outputTokens);
  const revenueKrw = pCharged * 1; // 1 P = 1 KRW 가정
  const marginRatio = revenueKrw > 0 ? (revenueKrw - costKrw) / revenueKrw : 0;
  const payload = {
    modelId,
    pCharged,
    inputTokens,
    outputTokens,
    costKrw: Math.round(costKrw * 100) / 100,
    revenueKrw,
    marginRatio: Math.round(marginRatio * 10000) / 100,
    ...meta,
  };
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.info("[chat-margin]", JSON.stringify(payload));
  }
}
