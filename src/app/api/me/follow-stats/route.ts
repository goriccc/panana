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

/** 캐릭터의 실시간 팔로워/팔로잉 수 + 현재 유저의 팔로우 여부 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const characterSlug = String(url.searchParams.get("characterSlug") || "").trim().toLowerCase();
    const pananaId = String(url.searchParams.get("pananaId") || "").trim();
    if (!characterSlug) return NextResponse.json({ ok: false, error: "Missing characterSlug" }, { status: 400 });

    const sb = getSb();

    const [
      userCountRes,
      charFollowsMeRes,
      charIFollowRes,
      charFollowsUserCountRes,
      isFollowingRes,
    ] = await Promise.all([
      sb.from("panana_user_follows_character").select("panana_id", { count: "exact", head: true }).eq("character_slug", characterSlug),
      sb.from("panana_character_follows").select("follower_character_slug", { count: "exact", head: true }).eq("following_character_slug", characterSlug),
      sb.from("panana_character_follows").select("following_character_slug", { count: "exact", head: true }).eq("follower_character_slug", characterSlug),
      sb.from("panana_character_follows_user").select("panana_id", { count: "exact", head: true }).eq("character_slug", characterSlug),
      pananaId && isUuid(pananaId)
        ? sb.from("panana_user_follows_character").select("panana_id").eq("panana_id", pananaId).eq("character_slug", characterSlug).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const baseFollowers = 0;
    const baseFollowing = 0;
    const userFollowCount = typeof (userCountRes as { count?: number }).count === "number" ? (userCountRes as { count: number }).count : 0;
    const charFollowsMeCount = typeof (charFollowsMeRes as { count?: number }).count === "number" ? (charFollowsMeRes as { count: number }).count : 0;
    const charIFollowCount = typeof (charIFollowRes as { count?: number }).count === "number" ? (charIFollowRes as { count: number }).count : 0;
    const charFollowsUserCount = typeof (charFollowsUserCountRes as { count?: number }).count === "number" ? (charFollowsUserCountRes as { count: number }).count : 0;
    const isFollowing = Boolean(isFollowingRes.data != null);

    return NextResponse.json({
      ok: true,
      followersTotal: baseFollowers + userFollowCount + charFollowsMeCount,
      followingTotal: baseFollowing + charIFollowCount + charFollowsUserCount,
      isFollowing,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
