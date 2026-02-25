"use client";

import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { FollowList } from "@/components/FollowList";
import { ensurePananaIdentity } from "@/lib/pananaApp/identity";
import type { FollowPerson } from "@/lib/follows";

export function MyFollowsClient({ tab }: { tab: "followers" | "following" }) {
  const [followers, setFollowers] = useState<FollowPerson[]>([]);
  const [following, setFollowing] = useState<FollowPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [pananaId, setPananaId] = useState<string | null>(null);

  const fetchList = useCallback(async (t: "followers" | "following") => {
    const pid = ensurePananaIdentity().id;
    if (pid) setPananaId(pid);
    if (!pid) return [];
    const params = new URLSearchParams({ tab: t, pananaId: pid });
    const res = await fetch(`/api/me/my-follows-list?${params}`);
    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok && Array.isArray(data.list)) {
      return data.list.map((x: any) => ({
        id: String(x.id || ""),
        name: String(x.name || x.id || ""),
        profileImageUrl: x.profileImageUrl ?? null,
        isFollowing: Boolean(x.isFollowing),
      }));
    }
    return [];
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchList("followers"), fetchList("following")]).then(([f, g]) => {
      if (!alive) return;
      setFollowers(f);
      setFollowing(g);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [fetchList]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title="마이 페이지" backHref="/my" />
      {loading ? (
        <div className="mx-auto max-w-[420px] px-4 py-12 text-center text-[13px] font-semibold text-white/45">
          불러오는 중...
        </div>
      ) : (
        <FollowList
          initialTab={tab}
          followers={followers}
          following={following}
          pananaId={pananaId}
        />
      )}
    </div>
  );
}

