import { createClient } from "@supabase/supabase-js";

export type BillingProductPublic = {
  id: string;
  sku: string;
  title: string;
  panaAmount: number;
  bonusAmount: number;
  priceKrw: number;
  sortOrder: number;
  recommended: boolean;
};

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** 서버 전용: active 충전 상품 목록 (페이지 첫 로드용) */
export async function getBillingProductsServer(): Promise<BillingProductPublic[]> {
  try {
    const sb = getSb();
    const { data, error } = await sb
      .from("panana_billing_products")
      .select("id, sku, title, pana_amount, bonus_amount, price_krw, sort_order, recommended")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) return [];
    return (data ?? []).map((r: any) => ({
      id: r.id,
      sku: r.sku,
      title: r.title ?? "파나나 충전",
      panaAmount: Number(r.pana_amount ?? 0),
      bonusAmount: Number(r.bonus_amount ?? 0),
      priceKrw: Number(r.price_krw ?? 0),
      sortOrder: Number(r.sort_order ?? 0),
      recommended: Boolean(r.recommended),
    }));
  } catch {
    return [];
  }
}
