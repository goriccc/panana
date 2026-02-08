import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { defaultRecommendationSettings, mergeRecommendationSettings } from "@/lib/pananaApp/recommendation";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSb() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

type Stat = {
  msgCount: number;
  recentCount: number;
  userCount: number;
  lastAt: number;
};

async function loadPopularSettings() {
  const sb = getSb();
  const { data, error } = await sb
    .from("panana_site_settings")
    .select("recommendation_settings")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("ranking settings error:", error);
    return defaultRecommendationSettings.popular;
  }
  const merged = mergeRecommendationSettings(data?.recommendation_settings as any);
  return merged.popular;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.max(4, Math.min(60, Number(url.searchParams.get("limit") || 24)));
    const gender = String(url.searchParams.get("gender") || "").trim().toLowerCase();
    const validGender = ["female", "male"].includes(gender) ? gender : null;

    const popular = await loadPopularSettings();
    const days = Math.max(7, Math.min(120, Number(url.searchParams.get("days") || popular.days)));
    const recentDays = Math.max(1, Math.min(30, Number(url.searchParams.get("recentDays") || popular.recentDays)));

    const sb = getSb();
    let stats = new Map<string, Stat>();
    let userSets: Map<string, Set<string>> | null = null;

    const canUseView = days === 30 && recentDays === 7;
    if (canUseView) {
      let data: any[] | null = null;
      const mvRes = await sb
        .from("panana_popular_characters_mv")
        .select("character_slug, msg_count_30d, msg_count_7d, user_count_30d, last_at_30d")
        .order("msg_count_30d", { ascending: false })
        .limit(2000);
      if (!mvRes.error) {
        data = mvRes.data as any[];
      } else {
        const vRes = await sb
          .from("panana_popular_characters_v")
          .select("character_slug, msg_count_30d, msg_count_7d, user_count_30d, last_at_30d")
          .order("msg_count_30d", { ascending: false })
          .limit(2000);
        if (!vRes.error) data = vRes.data as any[];
      }

      if (data?.length) {
        for (const r of data as any[]) {
          const slug = String(r.character_slug || "").trim();
          if (!slug) continue;
          const cur: Stat = {
            msgCount: Number(r.msg_count_30d || 0),
            recentCount: Number(r.msg_count_7d || 0),
            userCount: Number(r.user_count_30d || 0),
            lastAt: r.last_at_30d ? Date.parse(String(r.last_at_30d)) : 0,
          };
          stats.set(slug, cur);
        }
      }
    }

    if (!stats.size) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const recentSince = Date.now() - recentDays * 24 * 60 * 60 * 1000;
      const pageSize = 1000;
      let offset = 0;
      userSets = new Map<string, Set<string>>();

      for (;;) {
        const { data, error } = await sb
          .from("panana_chat_messages")
          .select("character_slug, user_id, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as Array<{ character_slug: string; user_id: string; created_at: string }>;
        if (!rows.length) break;

        for (const r of rows) {
          const slug = String(r.character_slug || "").trim();
          if (!slug) continue;
          const t = r.created_at ? Date.parse(r.created_at) : 0;
          const userId = String(r.user_id || "").trim();
          const cur = stats.get(slug) || { msgCount: 0, recentCount: 0, userCount: 0, lastAt: 0 };
          cur.msgCount += 1;
          if (t && t >= recentSince) cur.recentCount += 1;
          if (userId) {
            const set = userSets.get(slug) || new Set<string>();
            set.add(userId);
            userSets.set(slug, set);
          }
          if (t && t > cur.lastAt) cur.lastAt = t;
          stats.set(slug, cur);
        }
        if (rows.length < pageSize) break;
        offset += pageSize;
      }
    }

    const now = Date.now();
    if (userSets) {
      for (const [slug, set] of userSets.entries()) {
        const cur = stats.get(slug);
        if (cur) cur.userCount = set.size;
      }
    }

    const scored = Array.from(stats.entries()).map(([slug, s]) => {
      const userCount = s.userCount;
      const daysSince = s.lastAt ? Math.max(0, (now - s.lastAt) / (24 * 60 * 60 * 1000)) : days;
      const recencyBoost = Math.max(0, 1 - daysSince / days);
      const score =
        s.msgCount * popular.msgWeight +
        s.recentCount * popular.recentWeight +
        userCount * popular.userWeight +
        recencyBoost * userCount * popular.recencyWeight;
      return { slug, score, msgCount: s.msgCount, recentCount: s.recentCount, userCount };
    });

    const ranked = scored
      .sort((a, b) => (b.userCount !== a.userCount ? b.userCount - a.userCount : b.score - a.score))
      .slice(0, limit * 2);
    const slugs = ranked.map((r) => r.slug);

    if (!slugs.length) {
      return NextResponse.json({ ok: true, items: [] });
    }

    let charQ = sb
      .from("panana_characters")
      .select("slug, name, tagline, profile_image_url, handle, hashtags, gender")
      .eq("active", true)
      .in("slug", slugs);

    if (validGender) {
      charQ = charQ.or(`gender.eq.${validGender},gender.is.null`);
    }

    const { data: chars, error: charErr } = await charQ;
    if (charErr) throw charErr;

    const charMap = new Map((chars || []).map((c: any) => [c.slug, c]));
    const items: Array<{
      slug: string;
      name: string;
      tagline: string | null;
      profileImageUrl: string | null;
      handle: string | null;
      hashtags: string[];
      gender: string | null;
      msgCount: number;
      recentCount: number;
      userCount: number;
      score: number;
    }> = [];

    for (const r of ranked) {
      const c = charMap.get(r.slug);
      if (!c) continue;
      const hashtags = Array.isArray(c.hashtags) ? c.hashtags : [];
      items.push({
        slug: r.slug,
        name: c.name || r.slug,
        tagline: c.tagline || null,
        profileImageUrl: c.profile_image_url || null,
        handle: c.handle || null,
        hashtags: hashtags.filter((h: string) => String(h || "").trim()),
        gender: c.gender || null,
        msgCount: r.msgCount,
        recentCount: r.recentCount,
        userCount: r.userCount,
        score: r.score,
      });
      if (items.length >= limit) break;
    }

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
