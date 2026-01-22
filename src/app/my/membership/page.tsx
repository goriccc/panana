import type { Metadata } from "next";
import { MembershipClient } from "./ui";
import { fetchPublicMembershipBanners } from "@/lib/pananaApp/membershipPublic";

export const metadata: Metadata = {
  title: "멤버십 가입",
  description: "파나나 프리미엄 패스",
  alternates: { canonical: "/my/membership" },
};

export default async function MembershipPage() {
  const banners = await fetchPublicMembershipBanners();
  return <MembershipClient banners={banners} />;
}

