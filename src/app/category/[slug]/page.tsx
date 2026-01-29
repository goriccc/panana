import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/content";
import { fetchCategoryFromDb } from "@/lib/pananaApp/contentServer";
import { CategoryClient } from "./ui";

const getVirtualCategory = (slug: string) => {
  const s = String(slug || "").toLowerCase();
  if (s === "for-you" || s === "for-me") {
    return { slug, name: "나에게 맞는", items: [] };
  }
  return null;
};

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = getCategory(params.slug) || getVirtualCategory(params.slug);
  if (!c) return { title: "카테고리" };

  return {
    title: c.name,
    description: `Panana 카테고리: ${c.name}`,
    alternates: { canonical: `/category/${c.slug}` },
  };
}

export const revalidate = 60;

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const fromDb = await fetchCategoryFromDb(params.slug).catch(() => null);
  const c = fromDb || getCategory(params.slug) || getVirtualCategory(params.slug);
  if (!c) notFound();
  return <CategoryClient category={c} />;
}

