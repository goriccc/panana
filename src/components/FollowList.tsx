"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { FollowPerson } from "@/lib/follows";

type Tab = "followers" | "following";

function Avatar() {
  return (
    <div className="h-10 w-10 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
      {/* TODO: 어드민에서 avatar url 제공 시 Image로 교체 */}
      <Image src="/panana.png" alt="" width={40} height={40} className="h-full w-full object-cover opacity-0" />
    </div>
  );
}

function FollowButton({ isFollowing }: { isFollowing: boolean }) {
  if (isFollowing) {
    return (
      <button
        type="button"
        className="rounded-full bg-white/10 px-4 py-2 text-[12px] font-bold text-white/70"
      >
        팔로잉
      </button>
    );
  }
  return (
    <button type="button" className="rounded-full bg-panana-pink px-4 py-2 text-[12px] font-bold text-white">
      팔로우
    </button>
  );
}

export function FollowList({
  initialTab = "followers",
  followers,
  following,
}: {
  initialTab?: Tab;
  followers: FollowPerson[];
  following: FollowPerson[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const list = useMemo(() => (tab === "followers" ? followers : following), [tab, followers, following]);

  return (
    <div className="mx-auto w-full max-w-[420px] px-5 pb-20 pt-2">
      <div className="mt-1 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setTab("followers")}
          className={[
            "h-10 rounded-full text-[13px] font-extrabold",
            tab === "followers" ? "bg-[#ffa9d6] text-[#0B0C10]" : "bg-white/5 text-white/70 ring-1 ring-white/10",
          ].join(" ")}
        >
          팔로워
        </button>
        <button
          type="button"
          onClick={() => setTab("following")}
          className={[
            "h-10 rounded-full text-[13px] font-extrabold",
            tab === "following" ? "bg-[#ffa9d6] text-[#0B0C10]" : "bg-white/5 text-white/70 ring-1 ring-white/10",
          ].join(" ")}
        >
          팔로잉
        </button>
      </div>

      <div className="mt-3 divide-y divide-white/5 overflow-hidden rounded-[10px] border border-white/5 bg-white/[0.02]">
        {list.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar />
              <div className="min-w-0 text-[13px] font-semibold text-white/80">{p.name}</div>
            </div>
            <FollowButton isFollowing={p.isFollowing} />
          </div>
        ))}
      </div>
    </div>
  );
}

