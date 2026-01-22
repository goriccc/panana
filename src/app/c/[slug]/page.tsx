import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCharacter } from "@/lib/characters";
import { fetchCharacterProfileFromDb } from "@/lib/pananaApp/contentServer";
import { CharacterClient } from "./ui";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = getCharacter(params.slug);
  if (!c) return { title: "캐릭터" };
  return {
    title: c.name,
    description: `Panana 캐릭터: ${c.name}`,
    alternates: { canonical: `/c/${c.slug}` },
  };
}

export default async function CharacterPage({ params }: { params: { slug: string } }) {
  const fromDb = await fetchCharacterProfileFromDb(params.slug).catch(() => null);
  const c = fromDb || getCharacter(params.slug);
  if (!c) notFound();
  return <CharacterClient character={c} />;
}

