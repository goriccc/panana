import type { Metadata } from "next";
import { ChargeClient } from "./ui";
import { getBillingProductsServer } from "@/lib/pananaApp/billingProductsServer";

export const metadata: Metadata = {
  title: "마이 페이지",
  description: "파나나 충전",
  alternates: { canonical: "/my/charge" },
};

export const revalidate = 60;

export default async function ChargePage() {
  const initialProducts = await getBillingProductsServer();
  return <ChargeClient initialProducts={initialProducts} />;
}

