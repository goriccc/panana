/**
 * 채팅/음성 1회당 차감 P 계산 (구독 할인 반영).
 * 채팅·음성 차감을 수행하는 API에서 이 함수들을 사용하면 구독자 20%/50% 할인이 적용됩니다.
 */

import type { ChatModelId } from "./types";
import {
  P_PER_TURN,
  SUBSCRIPTION_DEEP_P_PER_TURN,
  SUBSCRIPTION_NSFW_DEEP_P_PER_TURN,
  P_PER_VOICE_SECOND,
  SUBSCRIPTION_VOICE_DISCOUNT_RATIO,
} from "./constants";

/** 채팅 1턴 차감 P. 구독자면 Deep 모델 20% 할인 (48/32 P) */
export function getChatPForTurn(
  modelId: ChatModelId,
  isSubscriber: boolean,
  mode: "normal" | "nsfw"
): number {
  const base = P_PER_TURN[modelId];
  if (!isSubscriber) return base;
  if (modelId === "claude_sonnet") return SUBSCRIPTION_DEEP_P_PER_TURN;
  if (modelId === "gemini_pro") return SUBSCRIPTION_NSFW_DEEP_P_PER_TURN;
  return base;
}

/** 음성 1초당 차감 P. 구독자면 50% 할인 (5 P/sec) */
export function getVoicePPerSecond(isSubscriber: boolean): number {
  if (!isSubscriber) return P_PER_VOICE_SECOND;
  return Math.round(P_PER_VOICE_SECOND * (1 - SUBSCRIPTION_VOICE_DISCOUNT_RATIO));
}
