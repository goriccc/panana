import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCharacter } from "@/lib/characters";
import { ProfileImageClient } from "./ui";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = getCharacter(params.slug);
  if (!c) return { title: "프로필 이미지" };
  return {
    title: "프로필 이미지",
    description: `${c.name} 프로필 이미지`,
    alternates: { canonical: `/c/${c.slug}/profile-image` },
  };
}

export default function ProfileImagePage({ params }: { params: { slug: string } }) {
  const c = getCharacter(params.slug);
  if (!c) notFound();
  return <ProfileImageClient character={c} />;
}

