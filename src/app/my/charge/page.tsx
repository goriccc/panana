import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { createClient } from "@supabase/supabase-js";
import { ChargeClient } from "./ui";
import { getBillingProductsServer } from "@/lib/pananaApp/billingProductsServer";
import { getBalanceForUserId } from "@/lib/pananaApp/balanceServer";

export const metadata: Metadata = {
  title: "마이 페이지",
  description: "파나나 충전",
  alternates: { canonical: "/my/charge" },
};

export const revalidate = 60;

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function ChargePage() {
  const [initialProducts, session] = await Promise.all([
    getBillingProductsServer(),
    getServerSession(authOptions),
  ]);
  let initialBalance: number | undefined;
  if (session) {
    try {
      const sb = getSb();
      const pananaId = await resolveUserId(sb, { pananaId: null, session });
      initialBalance = await getBalanceForUserId(sb, pananaId);
    } catch {
      initialBalance = 0;
    }
  }
  return <ChargeClient initialProducts={initialProducts} initialBalance={initialBalance} />;
}

