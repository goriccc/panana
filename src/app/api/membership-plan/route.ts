import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const PLAN_KEY = "panana_pass";

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const sb = getSb();
    const { data, error } = await sb
      .from("panana_membership_plans")
      .select("id, plan_key, title, payment_sku, price_krw")
      .eq("plan_key", PLAN_KEY)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: true, plan: null });
    }

    const plan = {
      id: (data as { id: string }).id,
      planKey: (data as { plan_key: string }).plan_key,
      title: (data as { title: string }).title ?? "파나나 패스",
      paymentSku: (data as { payment_sku: string | null }).payment_sku ?? null,
      priceKrw: typeof (data as { price_krw: number | null }).price_krw === "number" ? (data as { price_krw: number }).price_krw : null,
    };

    return NextResponse.json({ ok: true, plan });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message }, { status: 500 });
  }
}
