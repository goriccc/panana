/**
 * Billing & Usage DB/domain types (Supabase panana_billing_* / panana_usage_logs)
 * 1:1 Ratio: 1 KRW = 1 P; balance split into amount_base (cash value) and amount_bonus.
 */

export type TransactionType = "recharge" | "usage" | "bonus";
export type UsageMode = "normal" | "nsfw";

/** DB: panana_billing_profiles */
export interface BillingProfile {
  user_id: string;
  /** Total spendable P (amount_base + amount_bonus). Kept in sync on write. */
  panana_balance: number;
  /** P from paid recharge (1 KRW = 1 P). Consumed after amount_bonus. Optional until migration. */
  amount_base?: number;
  /** P from bonus. Consumed first. Optional until migration. */
  amount_bonus?: number;
  is_subscriber: boolean;
  subscription_type: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/** DB: panana_billing_transactions */
export interface BillingTransaction {
  id: string;
  user_id: string;
  /** Legacy; prefer total_amount for recharge, amount for usage/bonus. */
  amount: number;
  /** Recharge: paid P. Usage: deducted from base. */
  amount_base?: number | null;
  /** Recharge: bonus P. Usage: deducted from bonus first. */
  amount_bonus?: number | null;
  /** Recharge: amount_base + amount_bonus. */
  total_amount?: number | null;
  type: TransactionType;
  description: string | null;
  created_at: string;
}

/** DB: panana_usage_logs */
export interface UsageLog {
  id: string;
  user_id: string;
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  p_deducted: number;
  mode: UsageMode;
  created_at: string;
}

/** 내부용: 모델 티어 (유저에는 노출하지 않음) */
export type ModelTier = "standard" | "deep";

/** 내부용: 채팅용 백엔드 모델 식별자 (Final Spec: Dynamic Model Orchestrator) */
export type ChatModelId =
  | "claude_haiku"   // Normal (Standard): Claude 4.6 Haiku
  | "claude_sonnet"  // Normal (Deep): Claude 4.6 Sonnet
  | "gemini_flash"   // NSFW (Standard) / Voice: Gemini 2.5 Flash
  | "gemini_pro";    // NSFW (Deep): Gemini 2.5 Pro

/** 채팅 1회 요청에 필요한 컨텍스트 정보 (모델 선택·P 계산용) */
export interface ChatBillingContext {
  mode: UsageMode;
  /** 대략적인 컨텍스트 토큰 수 (시스템+히스토리+현재 입력) */
  contextTokenCount: number;
  /** 감정/복잡도 높음 여부 → Deep 전환 후보 */
  highEmotionalDepth?: boolean;
}

/** 음성 1회 세션(또는 5초 단위) 청크 정보 */
export interface VoiceBillingContext {
  durationSeconds: number;
  /** 구독 시 50% 할인 */
  isSubscriber: boolean;
}

/** P 차감 결과 (한 번의 usage에 대해) */
export interface DeductionResult {
  pDeducted: number;
  modelUsed: ChatModelId;
  inputTokens: number;
  outputTokens: number;
  mode: UsageMode;
}
