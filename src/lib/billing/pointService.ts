/**
 * 포인트 차감·잔액 검사 (대화 완료 즉시 차감, 부족 시 차단).
 * amount_bonus 먼저 차감 후 amount_base.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatModelId } from "./types";
import type { DeductionResult } from "./types";
import { getChatPForTurn } from "./computeP";
import { P_PER_VOICE_SECOND } from "./constants";
import { nowKstIso } from "@/lib/kst";

export interface ChatPointProfile {
  user_id: string;
  amount_base: number;
  amount_bonus: number;
  panana_balance: number;
  is_subscriber: boolean;
}

export async function getChatProfile(
  sb: SupabaseClient<any>,
  userId: string
): Promise<ChatPointProfile | null> {
  const { data } = await sb
    .from("panana_billing_profiles")
    .select("user_id, amount_base, amount_bonus, panana_balance, is_subscriber")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const row = data as any;
  return {
    user_id: String(row.user_id),
    amount_base: Number(row.amount_base ?? 0),
    amount_bonus: Number(row.amount_bonus ?? 0),
    panana_balance: Number(row.panana_balance ?? 0),
    is_subscriber: Boolean(row.is_subscriber),
  };
}

/** 1턴에 필요한 P (구독 할인 반영) */
export function getRequiredPForTurn(
  modelId: ChatModelId,
  isSubscriber: boolean,
  mode: "normal" | "nsfw" = "normal"
): number {
  return getChatPForTurn(modelId, isSubscriber, mode);
}

/** 잔액 부족 시 대화 차단. 호출 전에 검사 */
export function reserveOrReject(
  profile: ChatPointProfile | null,
  requiredP: number
): { allowed: boolean; error?: string } {
  if (!profile) {
    return { allowed: false, error: "잔액 정보를 불러올 수 없어요. 로그인 후 다시 시도해 주세요." };
  }
  const balance = Math.max(0, profile.panana_balance);
  if (balance < requiredP) {
    return {
      allowed: false,
      error: `파나나가 부족해요. (필요: ${requiredP} P, 보유: ${balance} P) 충전하거나 파나나 패스를 이용해 주세요.`,
    };
  }
  return { allowed: true };
}

/**
 * 대화 1턴 완료 후 P 차감. bonus 먼저 차감 후 base.
 * 반환: 새 잔액. 실패 시 throw.
 */
export async function deductAfterChat(
  sb: SupabaseClient<any>,
  userId: string,
  deduction: DeductionResult
): Promise<number> {
  const { data: profile } = await sb
    .from("panana_billing_profiles")
    .select("amount_base, amount_bonus, panana_balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) throw new Error("billing profile not found");

  const curBase = Math.max(0, Number((profile as any).amount_base ?? 0));
  const curBonus = Math.max(0, Number((profile as any).amount_bonus ?? 0));
  const curBalance = Math.max(0, Number((profile as any).panana_balance ?? 0));
  let pLeft = deduction.pDeducted;
  let fromBonus = Math.min(curBonus, pLeft);
  pLeft -= fromBonus;
  let fromBase = Math.min(curBase, pLeft);
  pLeft -= fromBase;
  if (pLeft > 0) {
    fromBase += pLeft;
  }
  const newBonus = curBonus - fromBonus;
  const newBase = curBase - fromBase;
  const newBalance = Math.max(0, newBonus + newBase);
  const now = nowKstIso();

  await sb
    .from("panana_billing_profiles")
    .update({
      amount_base: newBase,
      amount_bonus: newBonus,
      panana_balance: newBalance,
      updated_at: now,
    })
    .eq("user_id", userId);

  const { error: txErr } = await sb.from("panana_billing_transactions").insert({
    user_id: userId,
    amount: -deduction.pDeducted,
    type: "usage",
    amount_base: -fromBase,
    amount_bonus: -fromBonus,
    total_amount: -deduction.pDeducted,
    description: `채팅 1턴 (${deduction.modelUsed})`,
    created_at: now,
  } as any);
  if (txErr) throw new Error(txErr.message);

  return newBalance;
}

/** 음성 N초 사용분 P 차감 (구독/비구독 동일 10 P/초). bonus 먼저 차감. 잔액 부족 시 throw. */
export async function deductVoice(
  sb: SupabaseClient<any>,
  userId: string,
  durationSeconds: number
): Promise<number> {
  if (durationSeconds <= 0) {
    const { data: p } = await sb
      .from("panana_billing_profiles")
      .select("panana_balance")
      .eq("user_id", userId)
      .maybeSingle();
    return Math.max(0, Number((p as any)?.panana_balance ?? 0));
  }
  const pDeducted = Math.max(1, Math.floor(durationSeconds * P_PER_VOICE_SECOND));

  const { data: profile } = await sb
    .from("panana_billing_profiles")
    .select("amount_base, amount_bonus, panana_balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) throw new Error("billing profile not found");

  const curBase = Math.max(0, Number((profile as any).amount_base ?? 0));
  const curBonus = Math.max(0, Number((profile as any).amount_bonus ?? 0));
  const curBalance = Math.max(0, Number((profile as any).panana_balance ?? 0));
  if (curBalance < pDeducted) {
    throw new Error(
      `파나나가 부족해요. (음성 ${durationSeconds}초 ≈ ${pDeducted} P, 보유: ${curBalance} P)`
    );
  }

  let pLeft = pDeducted;
  const fromBonus = Math.min(curBonus, pLeft);
  pLeft -= fromBonus;
  const fromBase = Math.min(curBase, pLeft);
  const newBonus = curBonus - fromBonus;
  const newBase = curBase - fromBase;
  const newBalance = Math.max(0, newBonus + newBase);
  const now = nowKstIso();

  await sb
    .from("panana_billing_profiles")
    .update({
      amount_base: newBase,
      amount_bonus: newBonus,
      panana_balance: newBalance,
      updated_at: now,
    })
    .eq("user_id", userId);

  const { error: txErr } = await sb.from("panana_billing_transactions").insert({
    user_id: userId,
    amount: -pDeducted,
    type: "usage",
    amount_base: -fromBase,
    amount_bonus: -fromBonus,
    total_amount: -pDeducted,
    description: `음성 ${durationSeconds}초`,
    created_at: now,
  } as any);
  if (txErr) throw new Error(txErr.message);

  return newBalance;
}
