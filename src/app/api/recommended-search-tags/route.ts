import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TAGS = ["#현실연애", "#롤플주의", "#고백도전", "#연애감정", "#환승연애"];

function normalizeTag(t: unknown): string {
  const s = String(t ?? "").trim();
  return s.startsWith("#") ? s : `#${s}`;
}

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ recommendedSearchTags: DEFAULT_TAGS });
    }
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from("panana_site_settings")
      .select("recommended_search_tags")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[recommended-search-tags]", error.message);
      return NextResponse.json({ recommendedSearchTags: DEFAULT_TAGS });
    }

    const raw = data?.recommended_search_tags;
    if (Array.isArray(raw) && raw.length) {
      const tags = (raw as unknown[]).map(normalizeTag).filter(Boolean);
      if (tags.length) {
        return NextResponse.json({ recommendedSearchTags: tags });
      }
    }
    return NextResponse.json({ recommendedSearchTags: DEFAULT_TAGS });
  } catch (e: any) {
    console.error("[recommended-search-tags]", e);
    return NextResponse.json({ recommendedSearchTags: DEFAULT_TAGS });
  }
}
