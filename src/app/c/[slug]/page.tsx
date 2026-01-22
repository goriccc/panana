import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCharacter } from "@/lib/characters";
import type { ContentCardItem } from "@/lib/content";
import { fetchCharacterProfileFromDb, fetchHomeCategoriesFromDb } from "@/lib/pananaApp/contentServer";
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

function normalizeTag(tag: string) {
  return String(tag || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();
}

function slugHash(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h;
}

function recommendByTags({
  characterSlug,
  characterTags,
  pool,
  limit,
}: {
  characterSlug: string;
  characterTags: string[];
  pool: ContentCardItem[];
  limit: number;
}): ContentCardItem[] {
  const tagSet = new Set(characterTags.map(normalizeTag).filter(Boolean));
  const items = pool.filter((it) => Boolean(it?.characterSlug) && it.characterSlug !== characterSlug);

  const scored = items
    .map((it) => {
      const tags = (it.tags || []).map(normalizeTag).filter(Boolean);
      let score = 0;
      for (const t of tags) {
        if (tagSet.has(t)) score += 1;
        else {
          // "유사" 처리(약하게): 부분 일치
          for (const ct of tagSet) {
            if (ct && t && (ct.includes(t) || t.includes(ct))) score += 0.25;
          }
        }
      }
      return { it, score };
    })
    .sort((a, b) => b.score - a.score);

  // 중복 제거: 같은 characterSlug가 여러 카테고리/카드에 있을 수 있어 1개만 노출
  // - 점수가 가장 높은 항목을 우선 채택
  const bySlug = new Map<string, { it: ContentCardItem; score: number }>();
  for (const x of scored) {
    const slug = x.it.characterSlug;
    if (!slug) continue;
    const prev = bySlug.get(slug);
    if (!prev || x.score > prev.score) bySlug.set(slug, x);
  }
  const uniqueScored = Array.from(bySlug.values()).sort((a, b) => b.score - a.score);

  // 태그 매칭이 있는 것만 우선
  const matched = uniqueScored.filter((x) => x.score > 0).map((x) => x.it);
  if (matched.length) return matched.slice(0, limit);

  // 매칭이 0개면: 캐릭터 슬러그 기반으로 "결정적" 순환 선택
  const uniqueItems = uniqueScored.map((x) => x.it);
  if (!uniqueItems.length) return [];
  const start = slugHash(characterSlug) % uniqueItems.length;
  const rotated = [...uniqueItems.slice(start), ...uniqueItems.slice(0, start)];
  return rotated.slice(0, limit);
}

export default async function CharacterPage({ params }: { params: { slug: string } }) {
  const fromDb = await fetchCharacterProfileFromDb(params.slug).catch(() => null);
  const c = fromDb || getCharacter(params.slug);
  if (!c) notFound();

  const cats = await fetchHomeCategoriesFromDb().catch(() => null);
  const pool = (cats || []).flatMap((cat) => cat.items || []);
  const recommendedTalkCards = recommendByTags({
    characterSlug: c.slug,
    characterTags: c.hashtags || [],
    pool,
    limit: 4,
  });

  return <CharacterClient character={c} recommendedTalkCards={recommendedTalkCards} />;
}

