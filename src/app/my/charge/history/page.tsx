import type { Metadata } from "next";
import { ChargeHistoryClient } from "./ui";

export const metadata: Metadata = {
  title: "충전내역",
  description: "파나나 충전 내역",
  alternates: { canonical: "/my/charge/history" },
};

export default function ChargeHistoryPage() {
  return <ChargeHistoryClient />;
}
