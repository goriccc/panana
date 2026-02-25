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

/** 정규화: # 있으면 그대로, 없으면 # 붙여서 소문자 비교용 */
function normalizeTag(t: string): string {
  const s = String(t || "").trim();
  if (!s) return "";
  return s.startsWith("#") ? s.toLowerCase() : `#${s.toLowerCase()}`;
}

/** 어드민: 해당 캐릭터의 팔로잉/팔로워 슬러그 목록 조회 */
export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const characterSlug = String(url.searchParams.get("characterSlug") || "").trim().toLowerCase();
    if (!characterSlug) {
      return NextResponse.json({ ok: false, error: "characterSlug 필요해요." }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const [followingRes, followerRes] = await Promise.all([
      sb
        .from("panana_character_follows")
        .select("following_character_slug")
        .eq("follower_character_slug", characterSlug),
      sb
        .from("panana_character_follows")
        .select("follower_character_slug")
        .eq("following_character_slug", characterSlug),
    ]);
    const followingSlugs = (followingRes.data || []).map((r: any) => String(r.following_character_slug || "").toLowerCase()).filter(Boolean);
    const followerSlugs = (followerRes.data || []).map((r: any) => String(r.follower_character_slug || "").toLowerCase()).filter(Boolean);
    return NextResponse.json({ ok: true, followingSlugs, followerSlugs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "조회 실패" }, { status: 500 });
  }
}

/** 동일 태그 보유 캐릭터끼리 맞팔로우 등록. 어드민에서 캐릭터 저장 후 호출 */
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

    const body = (await req.json().catch(() => ({}))) as {
      characterSlug?: string;
      addFollowingSlugs?: string[];
      addFollowerSlugs?: string[];
      removeFollowingSlugs?: string[];
      removeFollowerSlugs?: string[];
    };
    const characterSlug = String(body?.characterSlug || "").trim().toLowerCase();
    if (!characterSlug) {
      return NextResponse.json({ ok: false, error: "characterSlug 필요해요." }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    const pairs: { follower_character_slug: string; following_character_slug: string }[] = [];

    // 1) 동일 태그 맞팔
    const { data: char, error: charErr } = await sb
      .from("panana_characters")
      .select("slug, hashtags")
      .eq("slug", characterSlug)
      .maybeSingle();
    if (charErr || !char?.slug) {
      return NextResponse.json({ ok: false, error: "캐릭터를 찾을 수 없어요." }, { status: 404 });
    }

    const myTags = new Set(
      (Array.isArray(char.hashtags) ? char.hashtags : [])
        .map(normalizeTag)
        .filter(Boolean)
    );

    let syncedSameTag = 0;
    if (myTags.size > 0) {
      const { data: allChars } = await sb
        .from("panana_characters")
        .select("slug, hashtags")
        .eq("active", true);
      const othersWithSameTag: string[] = [];
      for (const row of allChars || []) {
        const slug = String((row as any).slug || "").trim().toLowerCase();
        if (slug === characterSlug) continue;
        const tags = Array.isArray((row as any).hashtags) ? (row as any).hashtags : [];
        const hasOverlap = tags.some((t: string) => myTags.has(normalizeTag(t)));
        if (hasOverlap) othersWithSameTag.push(slug);
      }
      for (const other of othersWithSameTag) {
        pairs.push({ follower_character_slug: characterSlug, following_character_slug: other });
        pairs.push({ follower_character_slug: other, following_character_slug: characterSlug });
      }
      syncedSameTag = othersWithSameTag.length;
    }

    // 2) 관리자 수동 지정: 추가 팔로잉/팔로워
    const addFollowing = Array.isArray(body.addFollowingSlugs)
      ? body.addFollowingSlugs.map((s) => String(s).trim().toLowerCase()).filter((s) => s && s !== characterSlug)
      : [];
    const addFollower = Array.isArray(body.addFollowerSlugs)
      ? body.addFollowerSlugs.map((s) => String(s).trim().toLowerCase()).filter((s) => s && s !== characterSlug)
      : [];
    for (const s of addFollowing) {
      pairs.push({ follower_character_slug: characterSlug, following_character_slug: s });
    }
    for (const s of addFollower) {
      pairs.push({ follower_character_slug: s, following_character_slug: characterSlug });
    }

    // 3) 삭제: 관리자 언팔
    const removeFollowing = Array.isArray(body.removeFollowingSlugs)
      ? body.removeFollowingSlugs.map((s) => String(s).trim().toLowerCase()).filter((s) => s && s !== characterSlug)
      : [];
    const removeFollower = Array.isArray(body.removeFollowerSlugs)
      ? body.removeFollowerSlugs.map((s) => String(s).trim().toLowerCase()).filter((s) => s && s !== characterSlug)
      : [];
    for (const s of removeFollowing) {
      await sb
        .from("panana_character_follows")
        .delete()
        .eq("follower_character_slug", characterSlug)
        .eq("following_character_slug", s);
    }
    for (const s of removeFollower) {
      await sb
        .from("panana_character_follows")
        .delete()
        .eq("follower_character_slug", s)
        .eq("following_character_slug", characterSlug);
    }

    if (pairs.length === 0) {
      return NextResponse.json({ ok: true, synced: syncedSameTag });
    }

    const { error: upsertErr } = await sb.from("panana_character_follows").upsert(pairs, {
      onConflict: "follower_character_slug,following_character_slug",
    });
    if (upsertErr) throw upsertErr;

    return NextResponse.json({ ok: true, synced: syncedSameTag });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "동기화 실패" }, { status: 500 });
  }
}
