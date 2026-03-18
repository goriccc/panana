import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** subscription_started_at(KST ISO) 기준 +30일을 KST YYYY/MM/DD로 */
function nextPaymentDateFromStartedAt(startedAtIso: string | null): string | null {
  if (!startedAtIso || !startedAtIso.trim()) return null;
  try {
    const d = new Date(startedAtIso);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + 30);
    const kst = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
    const [y, m, day] = kst.replace(/\s/g, "").split(".");
    if (y && m && day) return `${y}/${m.padStart(2, "0")}/${day.padStart(2, "0")}`;
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    }
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: null, session });
    const { data: profile } = await sb
      .from("panana_billing_profiles")
      .select("is_subscriber, subscription_type, subscription_started_at")
      .eq("user_id", userId)
      .maybeSingle();

    const isSubscriber = Boolean((profile as { is_subscriber?: boolean })?.is_subscriber);
    if (!isSubscriber) {
      return NextResponse.json({ error: "구독 중인 멤버십이 없어요." }, { status: 404 });
    }

    const startedAt = (profile as { subscription_started_at?: string | null })?.subscription_started_at ?? null;
    const nextPaymentDate = nextPaymentDateFromStartedAt(startedAt);
    const planName = "파나나 프리미엄 패스";

    return NextResponse.json({
      planName,
      nextPaymentDate,
      subscriptionStartedAt: startedAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "구독 정보 조회에 실패했어요.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
