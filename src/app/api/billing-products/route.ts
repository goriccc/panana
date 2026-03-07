import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSb() {
  return createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

/** 앱 충전 화면용: active=true인 충전 상품 목록 (공개) */
export async function GET() {
  try {
    const sb = getSb();
    const { data, error } = await sb
      .from("panana_billing_products")
      .select("id, sku, title, pana_amount, bonus_amount, price_krw, sort_order, recommended")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      products: (data ?? []).map((r: any) => ({
        id: r.id,
        sku: r.sku,
        title: r.title ?? "파나나 충전",
        panaAmount: Number(r.pana_amount ?? 0),
        bonusAmount: Number(r.bonus_amount ?? 0),
        priceKrw: Number(r.price_krw ?? 0),
        sortOrder: Number(r.sort_order ?? 0),
        recommended: Boolean(r.recommended),
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
