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

/** 충전 상품 (스펙: 1:1 + 보너스). DB panana_billing_products 우선, 폴백용 */
export const RECHARGE_PRODUCTS: RechargeProductSpec[] = [
  { sku: "PANA_3000", title: "설레는 첫걸음", priceKrw: 2_900, panaAmount: 2_900, bonusAmount: 100 },
  { sku: "PANA_6500", title: "가까워지는 우리", priceKrw: 5_900, panaAmount: 5_900, bonusAmount: 600 },
  { sku: "PANA_15000", title: "깊어지는 대화", priceKrw: 12_900, panaAmount: 12_900, bonusAmount: 2_100 },
  { sku: "PANA_35000", title: "둘만의 비밀", priceKrw: 29_000, panaAmount: 29_000, bonusAmount: 6_000 },
  { sku: "PANA_60000", title: "끝없는 판타지", priceKrw: 49_000, panaAmount: 49_000, bonusAmount: 11_000 },
  { sku: "PANA_120000", title: "파나나 킹덤", priceKrw: 99_000, panaAmount: 99_000, bonusAmount: 21_000 },
];

/** Subscription: Panana Pass — 14,900 KRW/month. 15,000 P instantly (base 14,900 + bonus 100) + 500 P daily. */
export const PANANA_PASS_PLAN_KEY = "panana_pass";
export const PANANA_PASS_PRICE_KRW = 14_900;
export const PANANA_PASS_UPFRONT_P = 15_000;
export const PANANA_PASS_UPFRONT_BASE_P = 14_900;
export const PANANA_PASS_UPFRONT_BONUS_P = 100;
export const PANANA_PASS_DAILY_BONUS_P = 500;
/** 월 최대 발행: 즉시 15,000 + 500×30일 = 30,000 P */
export const PANANA_PASS_MONTHLY_CAP_P = 30_000;

/** Model tier mapping (Standard vs Deep) */
export const MODEL_TIER: Record<ChatModelId, ModelTier> = {
  claude_haiku: "standard",
  claude_sonnet: "deep",
  gemini_flash: "standard",
  gemini_pro: "deep",
};

/** Trial (맛보기): 가입 즉시 지급 P */
export const TRIAL_WELCOME_P = 500;
/** Trial: 비구독자 일일 지급 P (가입일 익일부터, 방문 시) */
export const TRIAL_DAILY_P = 100;
/** Trial: 무료 유저 음성 당일 최대 사용 초 (초과 시 유료 전환 유도) */
export const TRIAL_VOICE_MAX_SECONDS_PER_DAY = 30;
