import type { SupabaseClient } from "@supabase/supabase-js";
import { TRIAL_WELCOME_P } from "@/lib/billing/constants";
import { nowKstIso, todayKst } from "@/lib/kst";

/**
 * billing 프로필이 없으면 생성하고 맛보기 가입 500 P 지급.
 * 이미 프로필이 있으면 아무 작업도 하지 않음 (결제/구독으로 생성된 경우 포함).
 */
export async function ensureBillingProfileWithTrialWelcome(
  sb: SupabaseClient,
  userId: string
): Promise<{ created: boolean; error?: string }> {
  const { data: existing } = await sb
    .from("panana_billing_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return { created: false };

  const today = todayKst();
  const { error: insertErr } = await sb.from("panana_billing_profiles").insert({
    user_id: userId,
    amount_base: 0,
    amount_bonus: TRIAL_WELCOME_P,
    panana_balance: TRIAL_WELCOME_P,
    is_subscriber: false,
    has_ever_paid: false,
    trial_started_at: today,
    created_at: nowKstIso(),
    updated_at: nowKstIso(),
  });
  if (insertErr) return { created: false, error: insertErr.message };

  const { error: txErr } = await sb.from("panana_billing_transactions").insert({
    user_id: userId,
    amount: TRIAL_WELCOME_P,
    type: "bonus",
    amount_base: 0,
    amount_bonus: TRIAL_WELCOME_P,
    total_amount: TRIAL_WELCOME_P,
    description: "맛보기 가입 지급",
    created_at: nowKstIso(),
  });
  if (txErr) return { created: false, error: txErr.message };

  return { created: true };
}
