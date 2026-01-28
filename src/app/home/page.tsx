import type { Metadata } from "next";
import { HomeClient } from "./ui";
import { fetchHomeCategoriesFromDb, fetchMenuVisibilityFromDb, fetchRecommendationSettingsFromDb } from "@/lib/pananaApp/contentServer";

export const metadata: Metadata = {
  title: "홈",
  description: "Panana 캐릭터 채팅 홈",
  alternates: { canonical: "/home" },
};

export default async function HomePage() {
  const [cats, menuVisibility, recommendationSettings] = await Promise.all([
    fetchHomeCategoriesFromDb().catch(() => null),
    fetchMenuVisibilityFromDb().catch(() => null),
    fetchRecommendationSettingsFromDb().catch(() => null),
  ]);
  return (
    <HomeClient
      categories={cats || undefined}
      initialMenuVisibility={menuVisibility || undefined}
      initialRecommendationSettings={recommendationSettings || undefined}
    />
  );
}