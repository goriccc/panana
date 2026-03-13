import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { isTrialOnlyUser } from "@/lib/pananaApp/isTrialOnlyUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * xAI Grok Voice Agent용 ephemeral token 발급.
 * 실시간 양방향 통화는 유료(구독/충전 이력) 전용. 맛보기 전용 유저는 403.
 */
export async function POST() {
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
  if (isTrialOnlyUser(profile ?? null)) {
    return NextResponse.json(
      { ok: false, error: "실시간 음성 통화는 파나나 패스 가입 또는 충전 후 이용할 수 있어요." },
      { status: 403 }
    );
  }

  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "XAI_API_KEY가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (data as any)?.error?.message ?? (data as any)?.message ?? `HTTP ${res.status}`;
      return NextResponse.json({ ok: false, error: String(err) }, { status: res.status >= 500 ? 502 : 400 });
    }

    const clientSecret = (data as any)?.client_secret ?? (data as any)?.value;
    if (!clientSecret || typeof clientSecret !== "string") {
      return NextResponse.json({ ok: false, error: "토큰을 받지 못했습니다." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, client_secret: clientSecret });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
