import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { getBalanceForUserId } from "@/lib/pananaApp/balanceServer";
import { tryClaimDailyBonusIfEligible } from "@/lib/pananaApp/claimDailyBonus";
import { tryClaimTrialDailyIfEligible } from "@/lib/pananaApp/claimTrialDaily";
import { ensureBillingProfileWithTrialWelcome } from "@/lib/pananaApp/ensureBillingProfileWithTrialWelcome";
import { isTrialOnlyUser } from "@/lib/pananaApp/isTrialOnlyUser";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSb() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

/** 마이페이지용: 현재 유저의 파나나 잔액. 프로필 없으면 맛보기 1,000 P 생성. 구독자/비구독자 방문 시 일일 보너스 자동 수령 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pananaId = url.searchParams.get("pananaId") || undefined;
    const session = await getServerSession(authOptions);
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId, session });
    await ensureBillingProfileWithTrialWelcome(sb, userId);
    const claimResult = await tryClaimDailyBonusIfEligible(sb, userId);
    const trialClaimResult = await tryClaimTrialDailyIfEligible(sb, userId);
    const pananaBalance = await getBalanceForUserId(sb, userId);
    const { data: profile } = await sb
      .from("panana_billing_profiles")
      .select("is_subscriber, has_ever_paid")
      .eq("user_id", userId)
      .maybeSingle();
    const isTrialOnly = isTrialOnlyUser(profile ?? null);
    return NextResponse.json({
      ok: true,
      pananaBalance,
      dailyBonusClaimed: claimResult.claimed,
      trialDailyClaimed: trialClaimResult.claimed,
      isTrialOnly,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
