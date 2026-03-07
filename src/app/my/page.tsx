import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { createClient } from "@supabase/supabase-js";
import { getMyFollowStatsServer } from "@/lib/pananaApp/myFollowStatsServer";
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
  if (session) {
    try {
      const sb = getSb();
      const pananaId = await resolveUserId(sb, { pananaId: null, session });
      initialFollowStats = await getMyFollowStatsServer(pananaId);
    } catch {
      // 비로그인 또는 resolve 실패 시 null 유지
    }
  }
  return <MyPageClient initialFollowStats={initialFollowStats} />;
}

