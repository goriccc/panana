/**
 * BillingEngine: 채팅/음성 요청에 대한 모델 선택, P 계산, 차감, 트랜잭션·사용량 기록
 * 유저에는 모델명/기술 용어 노출하지 않고, 내부적으로만 모델 전환 및 P 정산
 */

import type {
  BillingProfile,
  ChatBillingContext,
  DeductionResult,
  VoiceBillingContext,
} from "./types";

/** BillingEngine 인터페이스 (서버 전용 구현체에서 주입) */
export interface BillingEngine {
  /**
   * 유저의 billing profile 조회. 없으면 생성하지 않고 null 반환 가능.
   */
  getProfile(userId: string): Promise<BillingProfile | null>;

  /**
   * 채팅 1턴에 사용할 모델 선택 + 해당 턴의 P 차감량 계산(실제 차감 없음).
   * context에 따라 Standard/Deep, Normal/NSFW 자동 선택.
   */
  computeChatDeduction(
    userId: string,
    context: ChatBillingContext,
    outputKoCharCount: number,
    inputKoCharCount: number
  ): Promise<DeductionResult | null>;

  /**
   * 채팅 1턴 실제 차감: 잔액 업데이트 + transaction + usage_log 기록.
   * 잔액 부족 시 한 번은 마이너스 허용(명세), 이후 충전 유도.
   */
  deductChat(
    userId: string,
    deduction: DeductionResult
  ): Promise<{ newBalance: number; allowed: boolean }>;

  /**
   * 음성 사용량 P 계산 (구독 시 50% 할인 적용).
   */
  computeVoiceDeduction(context: VoiceBillingContext): number;

  /**
   * 음성 5초 단위 차감 (실시간 음성 런어웨이 비용 방지).
   */
  deductVoice(
    userId: string,
    durationSeconds: number,
    isSubscriber: boolean
  ): Promise<{ newBalance: number; allowed: boolean }>;

  /**
   * 충전(일회성): 상품 sku 기준 P 적립 + transaction 기록.
   */
  recharge(userId: string, sku: string, amountP: number, description?: string): Promise<number>;

  /**
   * 일일 보너스(파나나 패스): 300 P 적립 + transaction.
   */
  addDailyBonus(userId: string, amountP: number): Promise<number>;

  /**
   * 잔액이 0 이하일 때 현재 턴만 허용한 뒤 충전 모달 트리거할지 여부.
   */
  shouldShowRechargeModal(userId: string): Promise<boolean>;
}
