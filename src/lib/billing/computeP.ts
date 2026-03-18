/**
 * 채팅/음성 1회당 차감 P 계산.
 * 멤버십 구독자 할인 없음 — 일반 충전과 동일 요금.
 */

import type { ChatModelId } from "./types";
import { P_PER_TURN, P_PER_VOICE_SECOND } from "./constants";

/** 채팅 1턴 차감 P (구독/비구독 동일) */
export function getChatPForTurn(
  modelId: ChatModelId,
  _isSubscriber: boolean,
  _mode: "normal" | "nsfw"
): number {
  return P_PER_TURN[modelId];
}

/** 음성 1초당 차감 P (구독/비구독 동일, 10 P/sec) */
export function getVoicePPerSecond(_isSubscriber: boolean): number {
  return P_PER_VOICE_SECOND;
}
