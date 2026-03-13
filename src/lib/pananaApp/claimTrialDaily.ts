import type { SupabaseClient } from "@supabase/supabase-js";
import { TRIAL_DAILY_P } from "@/lib/billing/constants";
import { todayKst, nowKstIso } from "@/lib/kst";

export type ClaimTrialDailyResult = { claimed: boolean; error?: string };

/**
 * 비구독자 맛보기 일일 100 P 수령 (가입일 익일부터, 방문 시에만).
 * 가입일 당일은 지급하지 않고, 당일 이미 수령했거나 구독자면 claimed: false.
 */
export async function tryClaimTrialDailyIfEligible(
  sb: SupabaseClient,
  userId: string
): Promise<ClaimTrialDailyResult> {
  const today = todayKst();

  const { data: profile, error: profileErr } = await sb
    .from("panana_billing_profiles")
    .select("user_id, is_subscriber, trial_started_at, amount_base, amount_bonus, panana_balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileErr || !profile) return { claimed: false };
  if ((profile as { is_subscriber?: boolean }).is_subscriber) return { claimed: false };

  const trialStartedAt = (profile as { trial_started_at?: string | null }).trial_started_at;
  if (trialStartedAt && today <= trialStartedAt) return { claimed: false };

  const { data: existing } = await sb
    .from("panana_trial_daily_grants")
    .select("id")
    .eq("user_id", userId)
    .eq("grant_date", today)
    .maybeSingle();

  if (existing) return { claimed: false };

  const curBonus = Number((profile as { amount_bonus?: number })?.amount_bonus ?? 0);
  const curBalance = Number((profile as { panana_balance?: number })?.panana_balance ?? 0);
  const addP = TRIAL_DAILY_P;

  const { error: updateErr } = await sb
    .from("panana_billing_profiles")
    .update({
      amount_bonus: curBonus + addP,
      panana_balance: curBalance + addP,
      updated_at: nowKstIso(),
    })
    .eq("user_id", userId);

  if (updateErr) return { claimed: false, error: updateErr.message };

  const { error: txErr } = await sb.from("panana_billing_transactions").insert({
    user_id: userId,
    amount: addP,
    type: "bonus",
    amount_base: 0,
    amount_bonus: addP,
    total_amount: addP,
    description: "맛보기 일일 보너스 (방문)",
    created_at: nowKstIso(),
  });
  if (txErr) return { claimed: false, error: txErr.message };

  const { error: grantErr } = await sb.from("panana_trial_daily_grants").insert({
    user_id: userId,
    grant_date: today,
    amount_p: addP,
    created_at: nowKstIso(),
  });
  if (grantErr) return { claimed: false, error: grantErr.message };

  return { claimed: true };
}
