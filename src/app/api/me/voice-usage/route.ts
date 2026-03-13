import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { TRIAL_VOICE_MAX_SECONDS_PER_DAY } from "@/lib/billing/constants";
import { isTrialOnlyUser } from "@/lib/pananaApp/isTrialOnlyUser";
import { todayKst, nowKstIso } from "@/lib/kst";

export const runtime = "nodejs";

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * 무료 유저 음성 사용 초 기록 (당일 누적).
 * 유료 유저는 기록하지 않음. 초과 분은 거부(409).
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }
    const body = (await req.json().catch(() => ({}))) as { seconds?: number };
    const seconds = typeof body.seconds === "number" ? Math.max(0, Math.floor(body.seconds)) : 0;
    if (seconds <= 0) {
      return NextResponse.json({ ok: true, recorded: 0, remaining: TRIAL_VOICE_MAX_SECONDS_PER_DAY });
    }
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: null, session });
    const { data: profile } = await sb
      .from("panana_billing_profiles")
      .select("is_subscriber, has_ever_paid")
      .eq("user_id", userId)
      .maybeSingle();
    if (!isTrialOnlyUser(profile ?? null)) {
      return NextResponse.json({ ok: true, recorded: 0, remaining: -1 });
    }
    const today = todayKst();
    const { data: row } = await sb
      .from("panana_voice_usage")
      .select("id, seconds_used")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .maybeSingle();
    const curUsed = Number((row as { seconds_used?: number })?.seconds_used ?? 0);
    const afterUsed = curUsed + seconds;
    if (afterUsed > TRIAL_VOICE_MAX_SECONDS_PER_DAY) {
      return NextResponse.json(
        {
          ok: false,
          error: "오늘 무료 음성 한도(30초)를 모두 사용했어요. 더 쓰려면 충전하거나 파나나 패스를 이용해 보세요.",
          remaining: Math.max(0, TRIAL_VOICE_MAX_SECONDS_PER_DAY - curUsed),
        },
        { status: 409 }
      );
    }
    if ((row as { id?: string })?.id) {
      const { error: updErr } = await sb
        .from("panana_voice_usage")
        .update({
          seconds_used: afterUsed,
          updated_at: nowKstIso(),
        })
        .eq("user_id", userId)
        .eq("usage_date", today);
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
    } else {
      const { error: insErr } = await sb.from("panana_voice_usage").insert({
        user_id: userId,
        usage_date: today,
        seconds_used: afterUsed,
        created_at: nowKstIso(),
        updated_at: nowKstIso(),
      });
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
    }
    const remaining = Math.max(0, TRIAL_VOICE_MAX_SECONDS_PER_DAY - afterUsed);
    return NextResponse.json({ ok: true, recorded: seconds, remaining });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
