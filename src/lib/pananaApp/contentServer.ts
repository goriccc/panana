import { createClient } from "@supabase/supabase-js";
import type { Category, ContentCardItem } from "@/lib/content";
import type { CharacterProfile } from "@/lib/characters";
import { defaultRecommendationSettings, mergeRecommendationSettings, type RecommendationSettings } from "@/lib/pananaApp/recommendation";

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

type PublicCategoryRow = { slug: string; title: string; sort_order: number };
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

type PublicCharacterRow = {
  slug: string;
  name: string;
  profile_image_url: string;
  mbti: string;
  followers_count: number;
  following_count: number;
  hashtags: string[] | null;
  intro_title: string;
  intro_lines: string[] | null;
  mood_title: string;
  mood_lines: string[] | null;
  posts_count: number;
};

export async function fetchHomeCategoriesFromDb(): Promise<Category[] | null> {
  const supabase = getSupabaseServer();

  // 1) 카테고리 목록
  const { data: cats, error: catsErr } = await supabase
    .from("panana_public_categories_v")
    .select("slug, title, sort_order")
    .order("sort_order", { ascending: true });
  if (catsErr) {
    console.error("[contentServer] panana_public_categories_v error:", catsErr);
    return null;
  }

  // 2) 모든 카드(카테고리-캐릭터 join)
  let cards: any[] | null = null;
  let cardsErr: any = null;
  {
    const res = await supabase
      .from("panana_public_category_cards_v")
      .select(
        "category_slug, category_title, category_sort_order, item_sort_order, character_slug, author_handle, title, description, tags, character_profile_image_url, safety_supported"
      )
      .order("category_sort_order", { ascending: true })
      .order("item_sort_order", { ascending: true });
    cards = res.data as any;
    cardsErr = res.error;
  }
  // 하위호환: safety_supported 컬럼/뷰가 아직 없을 수 있음 → fallback select
  if (cardsErr) {
    const msg = String(cardsErr?.message || "");
    if (msg.includes("safety_supported")) {
      console.warn(
        "[contentServer] safety_supported unavailable on panana_public_category_cards_v. Run docs/panana-admin/PUBLIC_VIEWS.sql (and migration) to expose/grant the column."
      );
      const retry = await supabase
        .from("panana_public_category_cards_v")
        .select(
          "category_slug, category_title, category_sort_order, item_sort_order, character_slug, author_handle, title, description, tags, character_profile_image_url"
        )
        .order("category_sort_order", { ascending: true })
        .order("item_sort_order", { ascending: true });
      if (retry.error) {
        console.error("[contentServer] panana_public_category_cards_v error:", retry.error);
        return null;
      }
      cards = retry.data as any;
    } else {
      console.error("[contentServer] panana_public_category_cards_v error:", cardsErr);
      return null;
    }
  }

  const bySlug = new Map<string, ContentCardItem[]>();
  (cards as any[]).forEach((r: PublicCategoryCardRow) => {
    const arr = bySlug.get(r.category_slug) || [];
    arr.push({
      id: `${r.category_slug}:${r.character_slug}:${r.item_sort_order}`,
      characterSlug: r.character_slug,
      author: r.author_handle ? (r.author_handle.startsWith("@") ? r.author_handle : `@${r.author_handle}`) : "@panana",
      title: r.title,
      description: r.description || "",
      tags: (r.tags || []).map((t) => (t.startsWith("#") ? t : `#${t}`)),
      imageUrl: r.character_profile_image_url || undefined,
      safetySupported: Boolean((r as any)?.safety_supported),
    });
    bySlug.set(r.category_slug, arr);
  });

  return (cats as any as PublicCategoryRow[]).map((c) => ({
    slug: c.slug,
    name: c.title,
    items: (bySlug.get(c.slug) || []).slice(0, 12),
  }));
}

export async function fetchCategoryFromDb(slug: string): Promise<Category | null> {
  const supabase = getSupabaseServer();
  const { data: cat, error: catErr } = await supabase
    .from("panana_public_categories_v")
    .select("slug, title, sort_order")
    .eq("slug", slug)
    .maybeSingle();
  if (catErr || !cat) {
    if (catErr) console.error("[contentServer] panana_public_categories_v (single) error:", catErr);
    return null;
  }

  let cards: any[] | null = null;
  let cardsErr: any = null;
  {
    const res = await supabase
      .from("panana_public_category_cards_v")
      .select("category_slug, item_sort_order, character_slug, author_handle, title, description, tags, character_profile_image_url, safety_supported")
      .eq("category_slug", slug)
      .order("item_sort_order", { ascending: true });
    cards = res.data as any;
    cardsErr = res.error;
  }
  if (cardsErr) {
    const msg = String(cardsErr?.message || "");
    if (msg.includes("safety_supported")) {
      console.warn(
        "[contentServer] safety_supported unavailable on panana_public_category_cards_v. Run docs/panana-admin/PUBLIC_VIEWS.sql (and migration) to expose/grant the column."
      );
      const retry = await supabase
        .from("panana_public_category_cards_v")
        .select("category_slug, item_sort_order, character_slug, author_handle, title, description, tags, character_profile_image_url")
        .eq("category_slug", slug)
        .order("item_sort_order", { ascending: true });
      if (retry.error) {
        console.error("[contentServer] panana_public_category_cards_v (by slug) error:", retry.error);
        return null;
      }
      cards = retry.data as any;
    } else {
      console.error("[contentServer] panana_public_category_cards_v (by slug) error:", cardsErr);
      return null;
    }
  }

  const items: ContentCardItem[] = (cards as any as PublicCategoryCardRow[]).map((r) => ({
    id: `${slug}:${r.character_slug}:${r.item_sort_order}`,
    characterSlug: r.character_slug,
    author: r.author_handle ? (r.author_handle.startsWith("@") ? r.author_handle : `@${r.author_handle}`) : "@panana",
    title: r.title,
    description: r.description || "",
    tags: (r.tags || []).map((t) => (t.startsWith("#") ? t : `#${t}`)),
    imageUrl: r.character_profile_image_url || undefined,
    safetySupported: Boolean((r as any)?.safety_supported),
  }));

  return { slug: String(cat.slug), name: String((cat as any).title), items };
}

export async function fetchCharacterProfileFromDb(slug: string): Promise<CharacterProfile | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("panana_public_characters_v")
    .select(
      "slug, name, profile_image_url, mbti, followers_count, following_count, hashtags, intro_title, intro_lines, mood_title, mood_lines, posts_count"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[contentServer] panana_public_characters_v error:", error);
    return null;
  }
  const r = data as any as PublicCharacterRow;

  const hashtags = (r.hashtags || []).map((t) => (t.startsWith("#") ? t : `#${t}`));
  const introLines = r.intro_lines?.length ? r.intro_lines : [`${r.name}  ${r.mbti || ""}`.trim(), "", r.name ? `안녕하세요, ${r.name}에요.` : ""].filter(Boolean);
  const moodLines = r.mood_lines?.length ? r.mood_lines : [""];

  return {
    slug: r.slug,
    name: r.name,
    profileImageUrl: r.profile_image_url || undefined,
    mbti: r.mbti || "",
    followers: Number(r.followers_count || 0),
    following: Number(r.following_count || 0),
    hashtags,
    introTitle: r.intro_title || "소개합니다!",
    introLines,
    moodTitle: r.mood_title || "요즘 어때?",
    moodLines,
    photoCount: Number(r.posts_count || 0),
    photos: Array.from({ length: Number(r.posts_count || 0) }).map((_, i) => ({ id: `db-${r.slug}-${i + 1}` })),
    sections: [],
  };
}

// 세이프티(성인 전용) 지원 여부만 빠르게 조회(채팅 라우트 강제 차단 UX에 사용)
export async function fetchCharacterSafetySupportedFromDb(slug: string): Promise<boolean | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from("panana_public_characters_v").select("slug, safety_supported").eq("slug", slug).maybeSingle();
  if (error) {
    const msg = String((error as any)?.message || "");
    // 하위호환: 컬럼/뷰가 아직 없을 수 있음
    if (msg.includes("safety_supported")) {
      console.warn(
        "[contentServer] safety_supported unavailable on panana_public_characters_v. Run docs/panana-admin/PUBLIC_VIEWS.sql (and migration) to expose/grant the column."
      );
      return null;
    }
    console.error("[contentServer] panana_public_characters_v safety_supported error:", error);
    return null;
  }
  return Boolean((data as any)?.safety_supported);
}

export type MenuVisibility = {
  my: boolean;
  home: boolean;
  challenge: boolean;
  ranking: boolean;
  search: boolean;
};

export async function fetchMenuVisibilityFromDb(): Promise<MenuVisibility> {
  const supabase = getSupabaseServer();
  const defaultVisibility: MenuVisibility = {
    my: true,
    home: true,
    challenge: true,
    ranking: true,
    search: true,
  };

  const { data, error } = await supabase
    .from("panana_public_site_settings_v")
    .select("menu_visibility")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[contentServer] panana_public_site_settings_v menu_visibility error:", error);
    return defaultVisibility;
  }

  if (data?.menu_visibility) {
    return { ...defaultVisibility, ...(data.menu_visibility as MenuVisibility) };
  }

  return defaultVisibility;
}

export async function fetchRecommendationSettingsFromDb(): Promise<RecommendationSettings> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("panana_public_site_settings_v")
    .select("recommendation_settings")
    .limit(1)
    .maybeSingle();

  if (error) {
    const msg = String((error as any)?.message || "");
    if (msg.includes("recommendation_settings") || msg.includes("permission denied")) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[contentServer] recommendation_settings unavailable on panana_public_site_settings_v. Run docs/panana-admin/ADD_RECOMMENDATION_SETTINGS.sql and update PUBLIC_VIEWS.sql."
        );
      }
      return defaultRecommendationSettings;
    }
    console.error("[contentServer] panana_public_site_settings_v recommendation_settings error:", error);
    return defaultRecommendationSettings;
  }

  if (data?.recommendation_settings) {
    return mergeRecommendationSettings(data.recommendation_settings as any);
  }

  return defaultRecommendationSettings;
}