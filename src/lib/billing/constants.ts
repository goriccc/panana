/**
 * Panana AI: Final 1:1 Billing & Logic System
 * - 1 KRW = 1 P. Wallet: amount_base (Cash) + amount_bonus (Free).
 * - Dynamic Model Orchestrator: auto-select model, deduct P/turn (margin 80%).
 * - Constraint: amount_bonus consumed before amount_base.
 */

import type { ChatModelId, ModelTier } from "./types";

/** Dynamic Model Orchestrator: P per turn (margin 80%). Model names per Final Spec. */
export const P_PER_TURN: Record<ChatModelId, number> = {
  claude_haiku: 20,   // Normal (Standard): Claude 4.6 Haiku
  claude_sonnet: 60,  // Normal (Deep): Claude 4.6 Sonnet — subscriber uses SUBSCRIPTION_DEEP_P_PER_TURN
  gemini_flash: 10,   // NSFW (Standard): Gemini 2.5 Flash
  gemini_pro: 40,     // NSFW (Deep): Gemini 2.5 Pro — subscriber uses 32
};

/** Subscriber: Normal Deep P per turn (20% off) */
export const SUBSCRIPTION_DEEP_P_PER_TURN = 48;
/** Subscriber: NSFW Deep P per turn (20% off) */
export const SUBSCRIPTION_NSFW_DEEP_P_PER_TURN = 32;

/** Legacy: 한글 기준 P당 문자 수 (token-based 참고용; 고정 P/turn 사용 시 미사용) */
export const P_PER_KO_CHARS: Record<ChatModelId, number> = {
  claude_haiku: 120,
  claude_sonnet: 12,
  gemini_flash: 350,
  gemini_pro: 30,
};

/** Voice (Native Audio): Gemini 2.5 Flash, 10 P per second */
export const P_PER_VOICE_SECOND = 10;

/** 구독(파나나 패스): Deep 모델 P 20% 할인 */
export const SUBSCRIPTION_DEEP_DISCOUNT_RATIO = 0.2;

/** 구독: 음성 50% 할인 (할인 시 5 P/sec) */
export const SUBSCRIPTION_VOICE_DISCOUNT_RATIO = 0.5;

/** Standard → Deep 전환 기준 컨텍스트 토큰 수 */
export const DEEP_SWITCH_CONTEXT_TOKEN_THRESHOLD = 4000;

/** Financial Products: Recharge (1:1). DB panana_billing_products takes precedence. */
export interface RechargeProductSpec {
  sku: string;
  title: string;
  priceKrw: number;
  panaAmount: number;
  bonusAmount?: number;
}

export const RECHARGE_PRODUCTS: RechargeProductSpec[] = [
  { sku: "PANA_3000", title: "3,000 P", priceKrw: 2_900, panaAmount: 3_000 },
  { sku: "PANA_6500", title: "6,500 P", priceKrw: 5_900, panaAmount: 6_500 },
  { sku: "PANA_15000", title: "15,000 P", priceKrw: 12_900, panaAmount: 15_000 },
  { sku: "PANA_35000", title: "35,000 P", priceKrw: 29_000, panaAmount: 35_000 },
  { sku: "PANA_60000", title: "60,000 P", priceKrw: 49_000, panaAmount: 60_000 },
  { sku: "PANA_120000", title: "120,000 P", priceKrw: 99_000, panaAmount: 120_000 },
];

/** Subscription: Panana Pass — 14,900 KRW/month. 15,000 P instantly + 500 P daily login bonus. */
export const PANANA_PASS_PLAN_KEY = "panana_pass";
export const PANANA_PASS_PRICE_KRW = 14_900;
export const PANANA_PASS_UPFRONT_P = 15_000;
export const PANANA_PASS_DAILY_BONUS_P = 500;

/** Model tier mapping (Standard vs Deep) */
export const MODEL_TIER: Record<ChatModelId, ModelTier> = {
  claude_haiku: "standard",
  claude_sonnet: "deep",
  gemini_flash: "standard",
  gemini_pro: "deep",
};
