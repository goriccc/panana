import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { createClient } from "@supabase/supabase-js";
import { getMyFollowStatsServer } from "@/lib/pananaApp/myFollowStatsServer";
import { getBalanceForUserId } from "@/lib/pananaApp/balanceServer";
import { MyPageClient } from "./ui";

export const metadata: Metadata = {
  title: "마이 페이지",
  description: "Panana 마이 페이지",
  alternates: { canonical: "/my" },
};

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function MyPage() {
  const session = await getServerSession(authOptions);
  let initialFollowStats: { followersTotal: number; followingTotal: number } | null = null;
  let initialBalance: number | null = null;
  const initialNickname =
    session &&
    String(
      (session as any)?.pananaNickname ||
        (session as any)?.nickname ||
        (session as any)?.user?.name ||
        ""
    ).trim();
  const initialHandle =
    session && /^@[a-z]{4}\d{4}$/.test(String((session as any)?.pananaHandle || "").trim())
      ? String((session as any).pananaHandle).trim().toLowerCase()
      : undefined;
  const initialAvatarUrl =
    session &&
    (String((session as any)?.profileImageUrl || "").trim() ||
      String((session as any)?.user?.image || "").trim()) ||
    undefined;

  if (session) {
    try {
      const sb = getSb();
      const pananaId = await resolveUserId(sb, { pananaId: null, session });
      const [followStats, balance] = await Promise.all([
        getMyFollowStatsServer(pananaId),
        getBalanceForUserId(sb, pananaId),
      ]);
      initialFollowStats = followStats;
      initialBalance = balance;
    } catch {
      // 비로그인 또는 resolve 실패 시 null 유지
    }
  }
  return (
    <MyPageClient
      initialFollowStats={initialFollowStats}
      initialNickname={initialNickname || undefined}
      initialHandle={initialHandle}
      initialAvatarUrl={initialAvatarUrl}
      initialBalance={initialBalance ?? undefined}
    />
  );
}

