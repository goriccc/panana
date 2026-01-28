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

type CacheRow = {
  id: string;
  key: string;
  payload: any;
  updated_at: string;
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
    console.error("popular settings error:", error);
    return defaultRecommendationSettings.popular;
  }
  const merged = mergeRecommendationSettings(data?.recommendation_settings as any);
  return merged.popular;
}

async function loadCache(sb: ReturnType<typeof getSb>, key: string, ttlSec: number) {
  try {
    const { data, error } = await sb
      .from("panana_popular_cache")
      .select("id, key, payload, updated_at")
      .eq("key", key)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<CacheRow>();
    if (error || !data) return null;
    const ts = Date.parse(data.updated_at);
    if (!ts || Date.now() - ts > ttlSec * 1000) return null;
    return data.payload || null;
  } catch {
    return null;
  }
}

async function saveCache(sb: ReturnType<typeof getSb>, key: string, payload: any) {
  try {
    await sb.from("panana_popular_cache").insert({ key, payload });
  } catch {
    // ignore
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.max(4, Math.min(60, Number(url.searchParams.get("limit") || 24)));
    const popular = await loadPopularSettings();
    const days = Math.max(7, Math.min(120, Number(url.searchParams.get("days") || popular.days)));
    const recentDays = Math.max(1, Math.min(30, Number(url.searchParams.get("recentDays") || popular.recentDays)));

    const sb = getSb();
    const cacheKey = `days=${days}&recentDays=${recentDays}&limit=${limit}&weights=${[
      popular.msgWeight,
      popular.recentWeight,
      popular.userWeight,
      popular.recencyWeight,
    ].join(",")}`;
    const cached = await loadCache(sb, cacheKey, popular.cacheTtlSec);
    if (cached) {
      return NextResponse.json({ ok: true, cached: true, items: cached });
    }

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

    const ranked = scored.sort((a, b) => b.score - a.score).slice(0, limit);
    const payload = ranked.map((r) => ({
      slug: r.slug,
      score: r.score,
      msgCount: r.msgCount,
      recentCount: r.recentCount,
      userCount: r.userCount,
    }));
    await saveCache(sb, cacheKey, payload);

    return NextResponse.json({
      ok: true,
      items: payload,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
