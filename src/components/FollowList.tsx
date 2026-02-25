"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { FollowPerson } from "@/lib/follows";

type Tab = "followers" | "following";

function Avatar({ src, name }: { src?: string | null; name: string }) {
  return (
    <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <Image src="/dumyprofile.png" alt="" fill sizes="40px" className="object-cover opacity-90" />
      )}
    </div>
  );
}

export function FollowList({
  initialTab = "followers",
  followers,
  following,
  pananaId,
  onFollowChange,
}: {
  initialTab?: Tab;
  followers: FollowPerson[];
  following: FollowPerson[];
  pananaId?: string | null;
  onFollowChange?: (slug: string, isFollowing: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [localFollowState, setLocalFollowState] = useState<Record<string, boolean>>({});

  const list = useMemo(() => (tab === "followers" ? followers : following), [tab, followers, following]);

  const getIsFollowing = useCallback(
    (p: FollowPerson) => {
      if (p.id in localFollowState) return localFollowState[p.id];
      return p.isFollowing;
    },
    [localFollowState]
  );

  const handleFollowClick = useCallback(
    async (p: FollowPerson) => {
      if (!pananaId || loadingSlug) return;
      setLoadingSlug(p.id);
      try {
        const next = !getIsFollowing(p);
        const res = await fetch("/api/me/follow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pananaId,
            characterSlug: p.id,
            action: next ? "follow" : "unfollow",
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          setLocalFollowState((prev) => ({ ...prev, [p.id]: Boolean(data.isFollowing) }));
          onFollowChange?.(p.id, Boolean(data.isFollowing));
        }
      } finally {
        setLoadingSlug(null);
      }
    },
    [pananaId, loadingSlug, getIsFollowing, onFollowChange]
  );

  return (
    <div className="mx-auto w-full max-w-[420px] px-4 pb-20 pt-4">
      {/* 탭: 스크린샷처럼 활성=핑크, 비활성=어두운 배경 */}
      <div className="flex gap-2 rounded-full bg-white/5 p-1 ring-1 ring-white/10">
        <button
          type="button"
          onClick={() => setTab("followers")}
          className={`flex-1 rounded-full py-2.5 text-[13px] font-extrabold transition ${
            tab === "followers"
              ? "bg-[#ffa9d6] text-[#0B0C10]"
              : "text-white/70 hover:bg-white/5"
          }`}
        >
          팔로워
        </button>
        <button
          type="button"
          onClick={() => setTab("following")}
          className={`flex-1 rounded-full py-2.5 text-[13px] font-extrabold transition ${
            tab === "following"
              ? "bg-[#ffa9d6] text-[#0B0C10]"
              : "text-white/70 hover:bg-white/5"
          }`}
        >
          팔로잉
        </button>
      </div>

      {/* 리스트 */}
      <div className="mt-4 divide-y divide-white/10">
        {list.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-white/45">
            {tab === "followers" ? "팔로워가 없어요." : "팔로잉이 없어요."}
          </div>
        ) : (
          list.map((p) => {
            const isFollowing = getIsFollowing(p);
            const loading = loadingSlug === p.id;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-4"
              >
                <Link
                  href={`/c/${p.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90"
                  prefetch={true}
                >
                  <Avatar src={p.profileImageUrl} name={p.name} />
                  <span className="truncate text-[13px] font-semibold text-white/90">
                    {p.name || p.id}
                  </span>
                </Link>
                <button
                  type="button"
                  disabled={loading || !pananaId}
                  onClick={() => handleFollowClick(p)}
                  className={`flex-none rounded-full px-4 py-2 text-[12px] font-bold transition disabled:opacity-50 ${
                    isFollowing
                      ? "bg-white/10 text-white/70 ring-1 ring-white/10"
                      : "bg-[#ff4da7] text-white"
                  }`}
                >
                  {loading ? "..." : isFollowing ? "팔로잉" : "팔로우"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
