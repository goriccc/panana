"use client";

import { TopBar } from "@/components/TopBar";
import { FollowList } from "@/components/FollowList";
import { dummyFollowers, dummyFollowing } from "@/lib/follows";

export function CharacterFollowsClient({
  title,
  slug,
  tab,
}: {
  title: string;
  slug: string;
  tab: "followers" | "following";
}) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title={title} backHref={`/c/${slug}`} />
      <FollowList initialTab={tab} followers={dummyFollowers} following={dummyFollowing} />
    </div>
  );
}

