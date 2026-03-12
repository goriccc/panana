import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";

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

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await req.json()) as { paymentId?: string; sku?: string };
    const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    if (!paymentId || !sku) {
      return NextResponse.json({ ok: false, error: "paymentId와 sku가 필요해요." }, { status: 400 });
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

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const userId = await resolveUserId(sb, { pananaId: null, session });

    const { data: product, error: productErr } = await sb
      .from("panana_billing_products")
      .select("id, sku, title, pana_amount, bonus_amount, price_krw")
      .eq("sku", sku)
      .eq("active", true)
      .maybeSingle();

    if (productErr || !product) {
      return NextResponse.json({ ok: false, error: "해당 상품을 찾을 수 없어요." }, { status: 404 });
    }

    const priceKrw = Number((product as { price_krw?: number })?.price_krw ?? 0);
    const panaAmount = Number((product as { pana_amount?: number })?.pana_amount ?? 0);
    const bonusAmount = Number((product as { bonus_amount?: number })?.bonus_amount ?? 0);
    const totalP = panaAmount + bonusAmount;

    if (payment.totalAmount !== priceKrw) {
      return NextResponse.json(
        { ok: false, error: "결제 금액이 상품 금액과 일치하지 않아요." },
        { status: 400 }
      );
    }

    const { data: profile } = await sb
      .from("panana_billing_profiles")
      .select("user_id, amount_base, amount_bonus, panana_balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile) {
      const curBase = Number((profile as { amount_base?: number })?.amount_base ?? 0);
      const curBonus = Number((profile as { amount_bonus?: number })?.amount_bonus ?? 0);
      const curBalance = Number((profile as { panana_balance?: number })?.panana_balance ?? 0);
      const { error: updateErr } = await sb
        .from("panana_billing_profiles")
        .update({
          amount_base: curBase + panaAmount,
          amount_bonus: curBonus + bonusAmount,
          panana_balance: curBalance + totalP,
        })
        .eq("user_id", userId);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await sb.from("panana_billing_profiles").insert({
        user_id: userId,
        amount_base: panaAmount,
        amount_bonus: bonusAmount,
        panana_balance: totalP,
      });
      if (insertErr) throw insertErr;
    }

    const { error: txErr } = await sb.from("panana_billing_transactions").insert({
      user_id: userId,
      amount: totalP,
      type: "recharge",
      amount_base: panaAmount,
      amount_bonus: bonusAmount,
      total_amount: totalP,
      description: `충전: ${(product as { title?: string })?.title ?? sku}`,
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "결제 확인에 실패했어요.";
    console.warn("[payment/confirm]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
