import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCharacter } from "@/lib/characters";
import { fetchCharacterProfileFromDb } from "@/lib/pananaApp/contentServer";
import { CharacterChatClient } from "./ui";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = getCharacter(params.slug);
  if (!c) return { title: "채팅" };
  return {
    title: `${c.name} 채팅`,
    description: `${c.name}와(과) 대화해보세요.`,
    alternates: { canonical: `/c/${c.slug}/chat` },
  };
}

export default async function CharacterChatPage({ params }: { params: { slug: string } }) {
  const fromDb = await fetchCharacterProfileFromDb(params.slug).catch(() => null);
  const c = fromDb || getCharacter(params.slug);
  if (!c) notFound();
  return (
    <CharacterChatClient
      characterName={c.name}
      characterSlug={c.slug}
      backHref={`/c/${c.slug}`}
      characterAvatarUrl={(c as any).profileImageUrl || (c as any).profile_image_url || undefined}
    />
  );
}

