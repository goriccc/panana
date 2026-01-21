import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/content";
import { CategoryClient } from "./ui";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = getCategory(params.slug);
  if (!c) return { title: "카테고리" };

  return {
    title: c.name,
    description: `Panana 카테고리: ${c.name}`,
    alternates: { canonical: `/category/${c.slug}` },
  };
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const c = getCategory(params.slug);
  if (!c) notFound();
  return <CategoryClient category={c} />;
}

