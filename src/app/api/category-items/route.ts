import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anonKey, { auth: { persistSession: false } });
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

    {
      const res = await supabase
        .from("panana_public_category_cards_v")
        .select(
          "category_slug, category_title, category_sort_order, item_sort_order, character_slug, author_handle, title, description, tags, character_profile_image_url, safety_supported"
        )
        .eq("category_slug", slug)
        .order("item_sort_order", { ascending: true })
        .range(start, end);
      rows = res.data as any;
      err = res.error;
    }

    if (err) {
      const msg = String(err?.message || "");
      if (msg.includes("safety_supported")) {
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

    const normalized = (rows as any[] | null || []) as PublicCategoryCardRow[];
    const hasMore = normalized.length > limit;
    const sliced = normalized.slice(0, limit);

    const items = sliced.map((r: PublicCategoryCardRow) => ({
      id: `${r.category_slug}:${r.character_slug}:${r.item_sort_order}`,
      characterSlug: r.character_slug,
      author: r.author_handle ? (r.author_handle.startsWith("@") ? r.author_handle : `@${r.author_handle}`) : "@panana",
      title: r.title,
      description: r.description || "",
      tags: (r.tags || []).map((t) => (t.startsWith("#") ? t : `#${t}`)),
      imageUrl: r.character_profile_image_url || undefined,
      safetySupported: Boolean((r as any)?.safety_supported),
    }));
    return NextResponse.json({ ok: true, items, nextOffset: offset + items.length, hasMore });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
