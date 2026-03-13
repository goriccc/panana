import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import {
  PANANA_PASS_UPFRONT_BASE_P,
  PANANA_PASS_UPFRONT_BONUS_P,
  PANANA_PASS_UPFRONT_P,
} from "@/lib/billing/constants";
import { nowKstIso } from "@/lib/kst";

export const runtime = "nodejs";

const PORTONE_API_BASE = "https://api.portone.io";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function getPortOneToken(): Promise<string> {
  const apiSecret = mustEnv("PORTONE_API_SECRET");
  const res = await fetch(`${PORTONE_API_BASE}/login/api-secret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiSecret }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PortOne 로그인 실패: ${res.status} ${t}`);
  }
  const data = (await res.json()) as { accessToken?: string };
  if (!data?.accessToken) throw new Error("PortOne accessToken 없음");
  return data.accessToken;
}

async function getPaymentById(paymentId: string): Promise<{ status: string; totalAmount: number } | null> {
  const token = await getPortOneToken();
  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    const t = await res.text();
    throw new Error(`결제 조회 실패: ${res.status} ${t}`);
  }
  const data = (await res.json()) as {
    status?: string;
    totalAmount?: number;
    amount?: { total?: number };
  };
  const total =
    typeof data?.totalAmount === "number"
      ? data.totalAmount
      : typeof data?.amount?.total === "number"
        ? data.amount.total
        : 0;
  return {
    status: String(data?.status ?? ""),
    totalAmount: total,
  };
}

/** 빌링키로 첫 결제 요청 (이니시스 V2 구독 채널은 requestIssueBillingKeyAndPay 카드 미지원이라 loadIssueBillingKeyUI 후 서버에서 결제) */
async function payWithBillingKey(
  paymentId: string,
  params: { billingKey: string; orderName: string; totalAmount: number }
): Promise<{ ok: boolean; error?: string }> {
  const token = await getPortOneToken();
  const res = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/billing-key/pay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      billingKey: params.billingKey,
      orderName: params.orderName,
      totalAmount: params.totalAmount,
      currency: "KRW",
    }),
  });
  const data = (await res.json()) as { status?: string; code?: string; message?: string };
  if (!res.ok) {
    return { ok: false, error: (data?.message ?? data?.code) || `결제 요청 실패: ${res.status}` };
  }
  if (data?.status && data.status !== "PAID" && data.status !== "paid") {
    return { ok: false, error: data?.message ?? "결제가 완료되지 않았어요." };
  }
  return { ok: true };
}

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await req.json()) as {
      paymentId?: string;
      sku?: string;
      billingKey?: string;
      orderName?: string;
      totalAmount?: number;
    };
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    if (!paymentId || !sku) {
      return NextResponse.json({ ok: false, error: "paymentId와 sku가 필요해요." }, { status: 400 });
    }

    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: null, session });

    const { data: planRow, error: planErr } = await sb
      .from("panana_membership_plans")
      .select("id, plan_key, payment_sku, price_krw")
      .eq("plan_key", "panana_pass")
      .eq("active", true)
      .maybeSingle();

    if (planErr || !planRow) {
      return NextResponse.json({ ok: false, error: "멤버십 플랜을 찾을 수 없어요." }, { status: 404 });
    }

    const planSku = (planRow as { payment_sku: string | null }).payment_sku;
    const priceKrw = Number((planRow as { price_krw: number | null }).price_krw ?? 0);
    if (planSku !== sku || !priceKrw) {
      return NextResponse.json({ ok: false, error: "플랜 정보가 올바르지 않아요." }, { status: 400 });
    }

    const billingKey = typeof body.billingKey === "string" ? body.billingKey.trim() : "";
    if (billingKey) {
      const orderName = typeof body.orderName === "string" ? body.orderName.trim() : "파나나 패스";
      const totalAmount = Number(body.totalAmount) || priceKrw;
      const payRes = await payWithBillingKey(paymentId, { billingKey, orderName, totalAmount });
      if (!payRes.ok) {
        return NextResponse.json({ ok: false, error: payRes.error }, { status: 400 });
      }
    }

    const payment = await getPaymentById(paymentId);
    if (!payment) {
      return NextResponse.json({ ok: false, error: "결제 정보를 찾을 수 없어요." }, { status: 404 });
    }
    if (payment.status !== "PAID") {
      return NextResponse.json(
        { ok: false, error: "결제가 완료된 건이 아니에요." },
        { status: 400 }
      );
    }
    if (payment.totalAmount !== priceKrw) {
      return NextResponse.json(
        { ok: false, error: "결제 금액이 플랜 금액과 일치하지 않아요." },
        { status: 400 }
      );
    }

    const { data: profile } = await sb
      .from("panana_billing_profiles")
      .select("user_id, amount_base, amount_bonus, panana_balance")
      .eq("user_id", userId)
      .maybeSingle();

    const addBase = PANANA_PASS_UPFRONT_BASE_P;
    const addBonus = PANANA_PASS_UPFRONT_BONUS_P;
    const addTotal = PANANA_PASS_UPFRONT_P;

    if (profile) {
      const curBase = Number((profile as { amount_base?: number })?.amount_base ?? 0);
      const curBonus = Number((profile as { amount_bonus?: number })?.amount_bonus ?? 0);
      const curBalance = Number((profile as { panana_balance?: number })?.panana_balance ?? 0);
      await sb
        .from("panana_billing_profiles")
        .update({
          is_subscriber: true,
          subscription_type: "panana_pass",
          has_ever_paid: true,
          amount_base: curBase + addBase,
          amount_bonus: curBonus + addBonus,
          panana_balance: curBalance + addTotal,
          updated_at: nowKstIso(),
        })
        .eq("user_id", userId);
    } else {
      await sb.from("panana_billing_profiles").insert({
        user_id: userId,
        amount_base: addBase,
        amount_bonus: addBonus,
        panana_balance: addTotal,
        is_subscriber: true,
        subscription_type: "panana_pass",
        has_ever_paid: true,
        created_at: nowKstIso(),
        updated_at: nowKstIso(),
      });
    }

    const { error: txErr } = await sb.from("panana_billing_transactions").insert({
      user_id: userId,
      amount: addTotal,
      type: "bonus",
      amount_base: addBase,
      amount_bonus: addBonus,
      total_amount: addTotal,
      description: "파나나 패스 가입 즉시 지급",
      created_at: nowKstIso(),
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "멤버십 가입 확인에 실패했어요.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
