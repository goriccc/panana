import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

function getSb() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

/** 캐릭터의 팔로워/팔로잉 목록 (캐릭터만, 이름·프로필이미지·현재 유저의 팔로우 여부) */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const characterSlug = String(url.searchParams.get("characterSlug") || "").trim().toLowerCase();
    const tab = url.searchParams.get("tab") === "following" ? "following" : "followers";
    const pananaId = String(url.searchParams.get("pananaId") || "").trim();
    if (!characterSlug) return NextResponse.json({ ok: false, error: "Missing characterSlug" }, { status: 400 });

    const sb = getSb();

    const slugColumn = tab === "followers" ? "follower_character_slug" : "following_character_slug";
    const { data: followRows, error: followErr } = await sb
      .from("panana_character_follows")
      .select(slugColumn)
      .eq(tab === "followers" ? "following_character_slug" : "follower_character_slug", characterSlug);
    if (followErr) throw followErr;

    const slugs = [...new Set((followRows || []).map((r: any) => String(r[slugColumn] || "").trim().toLowerCase()).filter(Boolean))];
    if (slugs.length === 0) {
      return NextResponse.json({ ok: true, list: [] });
    }

    const { data: chars, error: charErr } = await sb
      .from("panana_characters")
      .select("slug, name, profile_image_url")
      .in("slug", slugs)
      .eq("active", true);
    if (charErr) throw charErr;

    const list = (chars || []).map((r: any) => ({
      id: String(r.slug || ""),
      name: String(r.name || r.slug || ""),
      profileImageUrl: r.profile_image_url ? String(r.profile_image_url).trim() : null,
    }));

    if (!pananaId || !isUuid(pananaId)) {
      return NextResponse.json({ ok: true, list: list.map((c) => ({ ...c, isFollowing: false })) });
    }

    const { data: userFollows } = await sb
      .from("panana_user_follows_character")
      .select("character_slug")
      .eq("panana_id", pananaId)
      .in("character_slug", list.map((c) => c.id));
    const followedSet = new Set((userFollows || []).map((r: any) => String(r.character_slug || "").toLowerCase()));

    const listWithFollowing = list.map((c) => ({ ...c, isFollowing: followedSet.has(c.id) }));

    return NextResponse.json({ ok: true, list: listWithFollowing });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
