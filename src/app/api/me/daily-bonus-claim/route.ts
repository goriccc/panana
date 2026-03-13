import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { getBalanceForUserId } from "@/lib/pananaApp/balanceServer";
import { tryClaimDailyBonusIfEligible } from "@/lib/pananaApp/claimDailyBonus";
import { tryClaimTrialDailyIfEligible } from "@/lib/pananaApp/claimTrialDaily";
import { PANANA_PASS_DAILY_BONUS_P, TRIAL_DAILY_P } from "@/lib/billing/constants";

export const runtime = "nodejs";

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * 구독자 일일 500 P / 비구독자 맛보기 일일 100 P 수령 (가입일 익일부터, 방문 시 지급).
 * (실제 수령은 GET /api/me/balance 호출 시 자동 처리되며, 이 API는 명시적 수령 요청 시 사용)
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }

    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: null, session });
    const claimResult = await tryClaimDailyBonusIfEligible(sb, userId);
    const trialClaimResult = await tryClaimTrialDailyIfEligible(sb, userId);
    const pananaBalance = await getBalanceForUserId(sb, userId);
    const granted = claimResult.claimed || trialClaimResult.claimed;
    const amount = claimResult.claimed ? PANANA_PASS_DAILY_BONUS_P : trialClaimResult.claimed ? TRIAL_DAILY_P : undefined;

    return NextResponse.json({
      ok: true,
      granted,
      amount,
      pananaBalance,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
