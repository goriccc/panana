import type { Metadata } from "next";
import { MyFollowsClient } from "./ui";

export const metadata: Metadata = {
  title: "팔로워/팔로잉",
  description: "팔로워/팔로잉 목록",
  alternates: { canonical: "/my/follows" },
};

export default function MyFollowsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const tab = searchParams?.tab === "following" ? "following" : "followers";
  return <MyFollowsClient tab={tab} />;
}

