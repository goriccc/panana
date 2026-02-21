import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type PublicCategoryCardRow = {
  category_slug: string;
  category_title: string;
  category_sort_order: number;
  item_sort_order: number;
  character_slug: string;
  author_handle: string | null;
  title: string;
  description: string;
  tags: string[] | null;
  character_profile_image_url: string | null;
  safety_supported?: boolean | null;
  gender?: "male" | "female" | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = String(searchParams.get("slug") || "").trim();
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 12)));

    if (!slug) {
      return NextResponse.json({ ok: false, error: "missing slug" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const start = offset;
    const end = offset + limit; // fetch one extra to detect hasMore

    let rows: any[] | null = null;
    let err: any = null;

    if (slug === "new") {
      const client = getSupabaseAdmin() || supabase;
      const safetyParam = searchParams.get("safetySupported");
      const safetyFilter = safetyParam === "true" ? true : safetyParam === "false" ? false : undefined;
      const genderParam = searchParams.get("gender");
      const genderFilter = genderParam === "male" || genderParam === "female" ? genderParam : undefined;
      const q = client
        .from("panana_characters")
        .select("slug, name, tagline, profile_image_url, handle, hashtags, safety_supported, gender")
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (safetyFilter !== undefined) q.eq("safety_supported", safetyFilter);
      if (genderFilter) q.eq("gender", genderFilter);
      const res = await q.range(start, end);
      err = res.error;
      const raw = (res.data || []) as any[];
      rows = raw.map((r: any, i: number) => ({
        category_slug: "new",
        item_sort_order: start + i,
        character_slug: r.slug,
        author_handle: r.handle,
        title: r.name,
        description: r.tagline,
        tags: r.hashtags,
        character_profile_image_url: r.profile_image_url,
        safety_supported: r.safety_supported,
        gender: r.gender ?? null,
      }));
    } else {
      {
        const res = await supabase
          .from("panana_public_category_cards_v")
          .select(
            "category_slug, category_title, category_sort_order, item_sort_order, character_slug, author_handle, title, description, tags, character_profile_image_url, safety_supported, gender"
          )
          .eq("category_slug", slug)
          .order("item_sort_order", { ascending: true })
          .range(start, end);
        rows = res.data as any;
        err = res.error;
      }

      if (err) {
        const msg = String(err?.message || "");
        if (msg.includes("safety_supported") || msg.includes("gender")) {
          const retry = await supabase
            .from("panana_public_category_cards_v")
            .select(
              "category_slug, category_title, category_sort_order, item_sort_order, character_slug, author_handle, title, description, tags, character_profile_image_url"
            )
            .eq("category_slug", slug)
            .order("item_sort_order", { ascending: true })
            .range(start, end);
          if (retry.error) throw retry.error;
          rows = retry.data as any;
        } else {
          throw err;
        }
      }
    }

    /** 공백/콤마로 이어진 한 덩어리 문자열도 개별 태그 배열로 통일 (admin 저장 형식 차이 대응) */
    function normalizeTags(raw: string[] | string | null | undefined): string[] {
      if (raw == null) return [];
      const arr = Array.isArray(raw) ? raw : [raw];
      const out: string[] = [];
      for (const t of arr) {
        const s = String(t ?? "").trim();
        if (!s) continue;
        const parts = s.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
        for (const p of parts) out.push(p.startsWith("#") ? p : `#${p}`);
      }
      return out;
    }

    const normalized = (rows as any[] | null || []) as PublicCategoryCardRow[];
    const hasMore = normalized.length > limit;
    const sliced = normalized.slice(0, limit);

    const items = sliced.map((r: PublicCategoryCardRow) => ({
      id: `${r.category_slug}:${r.character_slug}:${r.item_sort_order}`,
      characterSlug: r.character_slug,
      author: r.author_handle ? (r.author_handle.startsWith("@") ? r.author_handle : `@${r.author_handle}`) : "@panana",
      title: r.title,
      description: r.description || "",
      tags: normalizeTags(r.tags),
      imageUrl: r.character_profile_image_url || undefined,
      safetySupported: Boolean((r as any)?.safety_supported),
      gender: (r as any)?.gender ?? null,
    }));
    return NextResponse.json({ ok: true, items, nextOffset: offset + items.length, hasMore });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
