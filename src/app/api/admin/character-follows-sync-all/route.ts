import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeTag(t: string): string {
  const s = String(t || "").trim();
  if (!s) return "";
  return s.startsWith("#") ? s.toLowerCase() : `#${s.toLowerCase()}`;
}

/** 등록된 전체 캐릭터에 대해 동일 태그 맞팔 배치 실행 */
export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAuthed(req);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }
    const { data: allow } = await supabase
      .from("panana_admin_users")
      .select("active")
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (!allow?.active) {
      return NextResponse.json({ ok: false, error: "권한이 없어요." }, { status: 403 });
    }

    const sb = getSupabaseAdmin();
    const { data: allChars, error: listErr } = await sb
      .from("panana_characters")
      .select("slug, hashtags")
      .eq("active", true);
    if (listErr) throw listErr;

    const chars = (allChars || []).map((r: any) => ({
      slug: String(r?.slug || "").trim().toLowerCase(),
      tags: new Set(
        (Array.isArray(r?.hashtags) ? r.hashtags : [])
          .map(normalizeTag)
          .filter(Boolean)
      ),
    })).filter((c) => c.slug);

    const pairSet = new Set<string>();
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        const a = chars[i];
        const b = chars[j];
        const overlap = [...a.tags].some((t) => b.tags.has(t));
        if (overlap) {
          pairSet.add(`${a.slug}\0${b.slug}`);
          pairSet.add(`${b.slug}\0${a.slug}`);
        }
      }
    }

    const pairs = Array.from(pairSet).map((key) => {
      const [follower, following] = key.split("\0");
      return { follower_character_slug: follower, following_character_slug: following };
    });

    if (pairs.length === 0) {
      return NextResponse.json({ ok: true, characters: chars.length, pairsInserted: 0 });
    }

    const { error: upsertErr } = await sb.from("panana_character_follows").upsert(pairs, {
      onConflict: "follower_character_slug,following_character_slug",
    });
    if (upsertErr) throw upsertErr;

    return NextResponse.json({
      ok: true,
      characters: chars.length,
      pairsInserted: pairs.length,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "배치 동기화 실패" }, { status: 500 });
  }
}
