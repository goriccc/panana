import type { Metadata } from "next";
import { SubscriptionClient } from "./ui";

export const metadata: Metadata = {
  title: "구독관리",
  description: "파나나 맴버십 구독 관리",
  alternates: { canonical: "/my/subscription" },
};

export default function SubscriptionPage() {
  return <SubscriptionClient />;
}
