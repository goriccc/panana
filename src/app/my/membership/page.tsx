import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { createClient } from "@supabase/supabase-js";
import { MembershipClient } from "./ui";
import { fetchPublicMembershipBanners } from "@/lib/pananaApp/membershipPublic";

export const metadata: Metadata = {
  title: "멤버십 가입",
  description: "파나나 프리미엄 패스",
  alternates: { canonical: "/my/membership" },
};

function getSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function MembershipPage() {
  const [banners, session] = await Promise.all([
    fetchPublicMembershipBanners(),
    getServerSession(authOptions),
  ]);

  let plan: { id: string; title: string; paymentSku: string; priceKrw: number } | null = null;
  try {
    const sb = getSb();
    const { data } = await sb
      .from("panana_membership_plans")
      .select("id, title, payment_sku, price_krw")
      .eq("plan_key", "panana_pass")
      .eq("active", true)
      .maybeSingle();
    if (data && (data as { payment_sku: string | null }).payment_sku && typeof (data as { price_krw: number }).price_krw === "number") {
      plan = {
        id: (data as { id: string }).id,
        title: (data as { title: string }).title ?? "파나나 패스",
        paymentSku: String((data as { payment_sku: string }).payment_sku),
        priceKrw: Number((data as { price_krw: number }).price_krw),
      };
    }
  } catch {
    /* ignore */
  }

  const buyerName = session?.user?.name ? String(session.user.name).trim() : "";
  const buyerEmail = session?.user?.email ? String(session.user.email).trim() : "";
  let buyerPhone = (session?.user as { phoneNumber?: string })?.phoneNumber
    ? String((session?.user as { phoneNumber: string })?.phoneNumber ?? "").trim()
    : "";
  if (!buyerPhone && session) {
    try {
      const sb = getSb();
      const userId = await resolveUserId(sb, { pananaId: null, session });
      const { data: row } = await sb
        .from("panana_users")
        .select("phone_number")
        .eq("id", userId)
        .maybeSingle();
      const dbPhone = (row as { phone_number?: string | null })?.phone_number;
      if (dbPhone && String(dbPhone).trim()) buyerPhone = String(dbPhone).trim();
    } catch {
      /* ignore */
    }
  }

  const firstBanner = Array.isArray(banners) ? banners.find((b) => b?.image_url) : null;
  const firstBannerImageUrl = firstBanner
    ? `/api/membership-banner-image?id=${encodeURIComponent(firstBanner.id)}`
    : null;

  return (
    <>
      {firstBannerImageUrl ? (
        <link rel="preload" as="image" href={firstBannerImageUrl} />
      ) : null}
      <MembershipClient
        banners={banners}
        plan={plan}
        buyerName={buyerName}
        buyerEmail={buyerEmail}
        buyerPhone={buyerPhone}
      />
    </>
  );
}

