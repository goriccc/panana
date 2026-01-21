import type { Metadata } from "next";
import { ChargeClient } from "./ui";

export const metadata: Metadata = {
  title: "마이 페이지",
  description: "파나나 충전",
  alternates: { canonical: "/my/charge" },
};

export default function ChargePage() {
  return <ChargeClient />;
}

