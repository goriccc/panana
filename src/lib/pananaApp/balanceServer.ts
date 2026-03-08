import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용: user_id에 해당하는 파나나 잔액 조회.
 * 1:1 명세(amount_base + amount_bonus)가 있으면 그 합계, 없으면 panana_balance 사용.
 */
export async function getBalanceForUserId(sb: SupabaseClient, userId: string): Promise<number> {
  const { data } = await sb
    .from("panana_billing_profiles")
    .select("panana_balance, amount_base, amount_bonus")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return 0;

  const row = data as { panana_balance?: number; amount_base?: number; amount_bonus?: number };
  const hasSplit =
    typeof row.amount_base === "number" && typeof row.amount_bonus === "number";
  const balance = hasSplit
    ? Math.max(0, Number(row.amount_base) + Number(row.amount_bonus))
    : typeof row.panana_balance === "number" ? Number(row.panana_balance) : 0;
  return Math.max(0, balance);
}
