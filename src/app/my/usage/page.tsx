import type { Metadata } from "next";
import { UsageHistoryClient } from "./ui";

export const metadata: Metadata = {
  title: "차감내역",
  description: "파나나 사용(소진) 내역",
  alternates: { canonical: "/my/usage" },
};

export default function UsageHistoryPage() {
  return <UsageHistoryClient />;
}
