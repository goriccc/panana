import { createClient } from "@supabase/supabase-js";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSb() {
  return createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

/** 마이 페이지 서버용: pananaId의 팔로워/팔로잉 수 (DB 집계). 로그인 시 첫 페인트에 사용 */
export async function getMyFollowStatsServer(pananaId: string): Promise<{
  followersTotal: number;
  followingTotal: number;
} | null> {
  if (!pananaId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pananaId)) {
    return null;
  }
  try {
    const sb = getSb();
    const [followersRes, followingRes] = await Promise.all([
      sb.from("panana_character_follows_user").select("panana_id", { count: "exact", head: true }).eq("panana_id", pananaId),
      sb.from("panana_user_follows_character").select("panana_id", { count: "exact", head: true }).eq("panana_id", pananaId),
    ]);
    const followersTotal = typeof (followersRes as { count?: number }).count === "number" ? (followersRes as { count: number }).count : 0;
    const followingTotal = typeof (followingRes as { count?: number }).count === "number" ? (followingRes as { count: number }).count : 0;
    return { followersTotal, followingTotal };
  } catch {
    return null;
  }
}
