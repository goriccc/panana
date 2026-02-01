import type { Metadata } from "next";
import { cookies } from "next/headers";
import { HomeClient } from "./ui";
import { fetchHomeCategoriesFromDb, fetchMenuVisibilityFromDb, fetchRecommendationSettingsFromDb } from "@/lib/pananaApp/contentServer";

export const metadata: Metadata = {
  title: "홈",
  description: "Panana 캐릭터 채팅 홈",
  alternates: { canonical: "/home" },
};

export const revalidate = 60;

export default async function HomePage() {
  const cookieStore = await cookies();
  const safetyCookie = cookieStore.get("panana_safety_on");
  const initialSafetyOn = safetyCookie ? safetyCookie.value === "1" : undefined;

  const [cats, menuVisibility, recommendationSettings] = await Promise.all([
    fetchHomeCategoriesFromDb().catch(() => null),
    fetchMenuVisibilityFromDb().catch(() => null),
    fetchRecommendationSettingsFromDb().catch(() => null),
  ]);
  return (
    <HomeClient
      categories={cats || undefined}
      initialSafetyOn={initialSafetyOn}
      initialMenuVisibility={menuVisibility || undefined}
      initialRecommendationSettings={recommendationSettings || undefined}
    />
  );
}