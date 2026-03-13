import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { TRIAL_VOICE_MAX_SECONDS_PER_DAY } from "@/lib/billing/constants";
import { isTrialOnlyUser } from "@/lib/pananaApp/isTrialOnlyUser";
import { todayKst } from "@/lib/kst";

export const runtime = "nodejs";

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * 무료 유저 음성 한도: 당일 남은 초, 실시간 통화 허용 여부.
 * 유료(구독/충전 이력)면 isRealtimeAllowed: true, remainingTrialSeconds는 무의미.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: null, session });
    const { data: profile } = await sb
      .from("panana_billing_profiles")
      .select("is_subscriber, has_ever_paid")
      .eq("user_id", userId)
      .maybeSingle();
    const trialOnly = isTrialOnlyUser(profile ?? null);
    const isRealtimeAllowed = !trialOnly;
    const today = todayKst();
    let remainingTrialSeconds = TRIAL_VOICE_MAX_SECONDS_PER_DAY;
    if (trialOnly) {
      const { data: row } = await sb
        .from("panana_voice_usage")
        .select("seconds_used")
        .eq("user_id", userId)
        .eq("usage_date", today)
        .maybeSingle();
      const used = Number((row as { seconds_used?: number })?.seconds_used ?? 0);
      remainingTrialSeconds = Math.max(0, TRIAL_VOICE_MAX_SECONDS_PER_DAY - used);
    }
    return NextResponse.json({
      ok: true,
      isRealtimeAllowed,
      remainingTrialSeconds,
      trialLimitSeconds: TRIAL_VOICE_MAX_SECONDS_PER_DAY,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
