import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCharacter } from "@/lib/characters";
import { fetchCharacterProfileFromDb } from "@/lib/pananaApp/contentServer";
import { CharacterFollowsClient } from "./ui";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = getCharacter(params.slug);
  if (!c) return { title: "팔로워" };
  return {
    title: `${c.name} 팔로워/팔로잉`,
    description: `${c.name}의 팔로워/팔로잉 목록`,
    alternates: { canonical: `/c/${c.slug}/follows` },
  };
}

export default async function CharacterFollowsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: { tab?: string };
}) {
  const fromDb = await fetchCharacterProfileFromDb(params.slug).catch(() => null);
  const c = fromDb || getCharacter(params.slug);
  if (!c) notFound();
  const tab = searchParams?.tab === "following" ? "following" : "followers";
  return <CharacterFollowsClient title={c.name} slug={c.slug} tab={tab} />;
}

