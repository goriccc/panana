"use client";

import { TopBar } from "@/components/TopBar";
import { FollowList } from "@/components/FollowList";
import { dummyFollowers, dummyFollowing } from "@/lib/follows";
import { myPageDummy } from "@/lib/myPage";

export function MyFollowsClient({ tab }: { tab: "followers" | "following" }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title={myPageDummy.name} backHref="/my" />
      <FollowList initialTab={tab} followers={dummyFollowers} following={dummyFollowing} />
    </div>
  );
}

