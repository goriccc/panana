import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSupabaseAuthed(req: Request) {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing Authorization token");
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function getSupabaseAdmin() {
  return createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

async function ensureAdmin(req: Request) {
  const supabase = getSupabaseAuthed(req);
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  const { data: allow } = await supabase
    .from("panana_admin_users")
    .select("active")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!allow?.active) {
    throw new Error("FORBIDDEN");
  }
  return userRes.user.id;
}

/** 어드민: 충전 상품 전체 목록 */
export async function GET(req: Request) {
  try {
    await ensureAdmin(req);
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("panana_billing_products")
      .select("id, sku, title, pana_amount, bonus_amount, price_krw, recommended, sort_order, active")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []).map((r: any) => ({
      id: r.id,
      sku: r.sku ?? "",
      title: r.title ?? "파나나 충전",
      panaAmount: Number(r.pana_amount ?? 0),
      bonusAmount: Number(r.bonus_amount ?? 0),
      priceKrw: Number(r.price_krw ?? 0),
      recommended: Boolean(r.recommended),
      sortOrder: Number(r.sort_order ?? 0),
      active: Boolean(r.active),
    }));
    return NextResponse.json({ ok: true, products: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: msg }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ ok: false, error: msg }, { status: 403 });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** 어드민: 상품 추가 */
export async function POST(req: Request) {
  try {
    await ensureAdmin(req);
    const body = await req.json().catch(() => ({}));
    const sku = String(body.sku ?? "").trim() || `PANA_${Date.now()}`;
    const title = String(body.title ?? "파나나 충전").trim();
    const pana_amount = Number(body.panaAmount ?? body.pana_amount ?? 0) || 0;
    const bonus_amount = Number(body.bonusAmount ?? body.bonus_amount ?? 0) || 0;
    const price_krw = Number(body.priceKrw ?? body.price_krw ?? 0) || 0;
    const recommended = Boolean(body.recommended);
    const active = Boolean(body.active !== false);

    const sb = getSupabaseAdmin();
    const { data: maxRow } = await sb
      .from("panana_billing_products")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSortOrder = maxRow != null ? Number((maxRow as any).sort_order ?? 0) + 1 : 0;
    const sort_order = Number(body.sortOrder ?? body.sort_order) || nextSortOrder;

    const { data, error } = await sb
      .from("panana_billing_products")
      .insert({
        sku,
        title,
        pana_amount,
        bonus_amount,
        price_krw,
        recommended,
        sort_order,
        active,
      })
      .select("id, sku, title, pana_amount, bonus_amount, price_krw, recommended, sort_order, active")
      .single();
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      product: {
        id: (data as any).id,
        sku: (data as any).sku,
        title: (data as any).title,
        panaAmount: Number((data as any).pana_amount),
        bonusAmount: Number((data as any).bonus_amount),
        priceKrw: Number((data as any).price_krw),
        recommended: Boolean((data as any).recommended),
        sortOrder: Number((data as any).sort_order),
        active: Boolean((data as any).active),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: msg }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ ok: false, error: msg }, { status: 403 });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** 어드민: 상품 삭제 */
export async function DELETE(req: Request) {
  try {
    await ensureAdmin(req);
    const url = new URL(req.url);
    let id = url.searchParams.get("id");
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }
    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("panana_billing_products").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: msg }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ ok: false, error: msg }, { status: 403 });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** 어드민: 상품 수정 */
export async function PATCH(req: Request) {
  try {
    await ensureAdmin(req);
    const body = await req.json().catch(() => ({}));
    const sb = getSupabaseAdmin();

    const setRecommendedId = body.setRecommended;
    if (setRecommendedId && typeof setRecommendedId === "string") {
      await sb.from("panana_billing_products").update({ recommended: false }).neq("id", setRecommendedId);
      const { data, error } = await sb
        .from("panana_billing_products")
        .update({ recommended: true })
        .eq("id", setRecommendedId)
        .select("id, sku, title, pana_amount, bonus_amount, price_krw, recommended, sort_order, active")
        .single();
      if (error) throw error;
      return NextResponse.json({
        ok: true,
        product: {
          id: (data as any).id,
          sku: (data as any).sku,
          title: (data as any).title,
          panaAmount: Number((data as any).pana_amount),
          bonusAmount: Number((data as any).bonus_amount),
          priceKrw: Number((data as any).price_krw),
          recommended: Boolean((data as any).recommended),
          sortOrder: Number((data as any).sort_order),
          active: Boolean((data as any).active),
        },
      });
    }

    const moveUpId = body.moveUp;
    const moveDownId = body.moveDown;
    if ((moveUpId || moveDownId) && typeof (moveUpId || moveDownId) === "string") {
      const targetId = moveUpId || moveDownId;
      const dir = moveUpId ? -1 : 1;
      const { data: list, error: listErr } = await sb
        .from("panana_billing_products")
        .select("id, sort_order")
        .order("sort_order", { ascending: true });
      if (listErr || !list?.length) throw new Error("목록 조회 실패");
      const rows = list as { id: string; sort_order: number }[];
      const idx = rows.findIndex((r) => r.id === targetId);
      if (idx < 0) throw new Error("상품을 찾을 수 없음");
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= rows.length) {
        return NextResponse.json({ ok: true }); // no-op at boundary
      }
      const a = rows[idx];
      const b = rows[swapIdx];
      await sb.from("panana_billing_products").update({ sort_order: b.sort_order }).eq("id", a.id);
      await sb.from("panana_billing_products").update({ sort_order: a.sort_order }).eq("id", b.id);
      const { data: refreshed, error: refErr } = await sb
        .from("panana_billing_products")
        .select("id, sku, title, pana_amount, bonus_amount, price_krw, recommended, sort_order, active")
        .order("sort_order", { ascending: true });
      if (refErr) throw refErr;
      const products = (refreshed ?? []).map((r: any) => ({
        id: r.id,
        sku: r.sku,
        title: r.title,
        panaAmount: Number(r.pana_amount),
        bonusAmount: Number(r.bonus_amount),
        priceKrw: Number(r.price_krw),
        recommended: Boolean(r.recommended),
        sortOrder: Number(r.sort_order),
        active: Boolean(r.active),
      }));
      return NextResponse.json({ ok: true, products });
    }

    const orderIds = body.reorder;
    if (Array.isArray(orderIds) && orderIds.length > 0) {
      const ids = orderIds.filter((x): x is string => typeof x === "string");
      for (let i = 0; i < ids.length; i++) {
        await sb.from("panana_billing_products").update({ sort_order: i }).eq("id", ids[i]);
      }
      const { data: refreshed, error: refErr } = await sb
        .from("panana_billing_products")
        .select("id, sku, title, pana_amount, bonus_amount, price_krw, recommended, sort_order, active")
        .order("sort_order", { ascending: true });
      if (refErr) throw refErr;
      const products = (refreshed ?? []).map((r: any) => ({
        id: r.id,
        sku: r.sku,
        title: r.title,
        panaAmount: Number(r.pana_amount),
        bonusAmount: Number(r.bonus_amount),
        priceKrw: Number(r.price_krw),
        recommended: Boolean(r.recommended),
        sortOrder: Number(r.sort_order),
        active: Boolean(r.active),
      }));
      return NextResponse.json({ ok: true, products });
    }
    const id = body.id ?? body.productId;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }
    const patch: Record<string, unknown> = {};
    if (body.sku !== undefined) patch.sku = String(body.sku).trim();
    if (body.title !== undefined) patch.title = String(body.title).trim();
    if (body.panaAmount !== undefined || body.pana_amount !== undefined)
      patch.pana_amount = Number(body.panaAmount ?? body.pana_amount ?? 0);
    if (body.bonusAmount !== undefined || body.bonus_amount !== undefined)
      patch.bonus_amount = Number(body.bonusAmount ?? body.bonus_amount ?? 0);
    if (body.priceKrw !== undefined || body.price_krw !== undefined)
      patch.price_krw = Number(body.priceKrw ?? body.price_krw ?? 0);
    if (body.sortOrder !== undefined || body.sort_order !== undefined)
      patch.sort_order = Number(body.sortOrder ?? body.sort_order ?? 0);
    if (body.recommended !== undefined) patch.recommended = Boolean(body.recommended);
    if (body.active !== undefined) patch.active = Boolean(body.active);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "no fields to update" }, { status: 400 });
    }
    const { data, error } = await sb
      .from("panana_billing_products")
      .update(patch)
      .eq("id", id)
      .select("id, sku, title, pana_amount, bonus_amount, price_krw, recommended, sort_order, active")
      .single();
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      product: {
        id: (data as any).id,
        sku: (data as any).sku,
        title: (data as any).title,
        panaAmount: Number((data as any).pana_amount),
        bonusAmount: Number((data as any).bonus_amount),
        priceKrw: Number((data as any).price_krw),
        recommended: Boolean((data as any).recommended),
        sortOrder: Number((data as any).sort_order),
        active: Boolean((data as any).active),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ ok: false, error: msg }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ ok: false, error: msg }, { status: 403 });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
