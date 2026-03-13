/**
 * 맛보기 전용 유저 여부: 구독자도 아니고, 한 번도 충전/구독 결제를 하지 않은 유저.
 * 음성 30초 제한·실시간 통화 유료 전용·전환율 지표 등에 사용.
 */

export interface BillingProfileForTrial {
  is_subscriber?: boolean;
  has_ever_paid?: boolean;
}

export function isTrialOnlyUser(profile: BillingProfileForTrial | null): boolean {
  if (!profile) return true;
  if ((profile as { is_subscriber?: boolean }).is_subscriber) return false;
  if ((profile as { has_ever_paid?: boolean }).has_ever_paid) return false;
  return true;
}
