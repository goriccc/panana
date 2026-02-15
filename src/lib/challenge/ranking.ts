import { createClient } from "@supabase/supabase-js";

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

export type RankingEntry = {
  rank: number;
  nickname: string;
  profileImageUrl: string | null;
  durationMs: number;
  completedAt: string | null;
};

/** 도전 랭킹 조회 (서버/API 공용) */
export async function fetchChallengeRanking(
  challengeId: string,
  opts?: { limit?: number; pananaId?: string }
): Promise<{ ranking: RankingEntry[]; myRank: { rank: number; durationMs: number; completedAt: string } | null }> {
  if (!isUuid(challengeId)) return { ranking: [], myRank: null };
  const limit = Math.max(1, Math.min(100, opts?.limit ?? 50));
  const pananaId = opts?.pananaId?.trim();
  const sb = getSb();

  let days = 30;
  try {
    const { data: sd } = await sb
      .from("panana_site_settings")
      .select("challenge_ranking_days")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sd) days = Math.max(7, Math.min(365, Number((sd as any)?.challenge_ranking_days ?? 30) || 30));
  } catch {}
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await sb
    .from("panana_challenge_completions")
    .select("user_id, duration_ms, completed_at, panana_users(nickname, profile_image_url)")
    .eq("challenge_id", challengeId)
    .gte("completed_at", since)
    .order("duration_ms", { ascending: true })
    .limit(limit);
  const ranking: RankingEntry[] = (rows || []).map((r: any, i: number) => {
    const pu = r.panana_users;
    const user = Array.isArray(pu) ? pu[0] : pu;
    return {
      rank: i + 1,
      nickname: user?.nickname || "익명",
      profileImageUrl: (user as any)?.profile_image_url || null,
      durationMs: Number(r.duration_ms) || 0,
      completedAt: r.completed_at || null,
    };
  });

  let myRank: { rank: number; durationMs: number; completedAt: string } | null = null;
  if (pananaId && isUuid(pananaId)) {
    const myRes = await sb
      .from("panana_challenge_completions")
      .select("duration_ms, completed_at")
      .eq("challenge_id", challengeId)
      .eq("user_id", pananaId)
      .gte("completed_at", since)
      .order("duration_ms", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (myRes.data) {
      const myDuration = Number((myRes.data as any).duration_ms) || 0;
      const { count } = await sb
        .from("panana_challenge_completions")
        .select("id", { count: "exact", head: true })
        .eq("challenge_id", challengeId)
        .gte("completed_at", since)
        .lt("duration_ms", myDuration);
      myRank = {
        rank: (count ?? 0) + 1,
        durationMs: myDuration,
        completedAt: (myRes.data as any).completed_at || "",
      };
    }
  }

  return { ranking, myRank };
}
