import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { nowKstIso } from "@/lib/kst";

export const runtime = "nodejs";

const PORTONE_API_BASE = "https://api.portone.io";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getPortOneToken(): Promise<string> {
  const apiSecret = mustEnv("PORTONE_API_SECRET");
  const res = await fetch(`${PORTONE_API_BASE}/login/api-secret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiSecret }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PortOne 로그인 실패: ${res.status} ${text}`);
  let data: { accessToken?: string } = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text) as { accessToken?: string };
    } catch {
      throw new Error("PortOne 로그인 응답 형식 오류");
    }
  }
  if (!data?.accessToken) throw new Error("PortOne accessToken 없음");
  return data.accessToken;
}

/** 포트원 빌링키 삭제 (카카오페이 등 PG에 해지 전달) */
async function deleteBillingKey(billingKey: string): Promise<{ ok: boolean; error?: string }> {
  const token = await getPortOneToken();
  const res = await fetch(`${PORTONE_API_BASE}/billing-keys/${encodeURIComponent(billingKey)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (res.status === 404) {
    return { ok: true };
  }
  if (!res.ok) {
    let msg = `빌링키 삭제 실패: ${res.status}`;
    if (text.trim()) {
      try {
        const data = JSON.parse(text) as { message?: string };
        if (data?.message) msg = data.message;
      } catch {}
    }
    return { ok: false, error: msg };
  }
  return { ok: true };
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: null, session });

    const { data: profile } = await sb
      .from("panana_billing_profiles")
      .select("is_subscriber, subscription_billing_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile || !(profile as { is_subscriber?: boolean }).is_subscriber) {
      return NextResponse.json({ ok: false, error: "구독 중인 멤버십이 없어요." }, { status: 400 });
    }

    const billingKey = (profile as { subscription_billing_key?: string | null })?.subscription_billing_key?.trim();
    if (billingKey) {
      const delRes = await deleteBillingKey(billingKey);
      if (!delRes.ok) {
        return NextResponse.json({ ok: false, error: delRes.error ?? "구독 해지 처리에 실패했어요." }, { status: 400 });
      }
    }

    await sb
      .from("panana_billing_profiles")
      .update({
        is_subscriber: false,
        subscription_type: null,
        subscription_billing_key: null,
        updated_at: nowKstIso(),
      })
      .eq("user_id", userId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "구독 해지에 실패했어요.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
