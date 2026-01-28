import type { Metadata } from "next";
import { HomeClient } from "./ui";
import { fetchHomeCategoriesFromDb, fetchMenuVisibilityFromDb } from "@/lib/pananaApp/contentServer";

export const metadata: Metadata = {
  title: "홈",
  description: "Panana 캐릭터 채팅 홈",
  alternates: { canonical: "/home" },
};

export default async function HomePage() {
  const [cats, menuVisibility] = await Promise.all([
    fetchHomeCategoriesFromDb().catch(() => null),
    fetchMenuVisibilityFromDb().catch(() => null),
  ]);
  return <HomeClient categories={cats || undefined} initialMenuVisibility={menuVisibility || undefined} />;
}