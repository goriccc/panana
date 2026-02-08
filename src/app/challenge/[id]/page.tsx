import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { fetchChallengeRanking } from "@/lib/challenge/ranking";
import { ChallengeClient } from "./ui";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSb() {
  return createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sb = getSb();
  const { data } = await sb
    .from("panana_challenges")
    .select("title")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  const title = (data as any)?.title || "도전";
  return { title: `${title} | 도전 모드` };
}

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = getSb();
  const [challengeRes, rankingRes] = await Promise.all([
    sb
      .from("panana_challenges")
      .select(
        `
      id,
      character_id,
      title,
      challenge_goal,
      challenge_situation,
      success_keywords,
      partial_match,
      gender,
        panana_characters!inner(slug, name, profile_image_url, hashtags)
    `
      )
      .eq("id", id)
      .eq("active", true)
      .maybeSingle(),
    fetchChallengeRanking(id, { limit: 50 }),
  ]);

  const { data, error } = challengeRes;
  if (error || !data) notFound();
  const { ranking: initialRanking } = rankingRes;
  const ch = (data as any).panana_characters;
  const char = Array.isArray(ch) ? ch[0] : ch;

  const hashtags = Array.isArray(char?.hashtags) ? char.hashtags.filter((h: string) => String(h || "").trim()) : [];
  const item = {
    id: data.id,
    characterId: data.character_id,
    characterSlug: char?.slug || "",
    characterName: char?.name || "",
    profileImageUrl: char?.profile_image_url || null,
    hashtags,
    title: (data as any).title || "",
    challengeGoal: (data as any).challenge_goal || "",
    challengeSituation: (data as any).challenge_situation || "",
    successKeywords: Array.isArray((data as any).success_keywords) ? (data as any).success_keywords : [],
    partialMatch: Boolean((data as any).partial_match),
  };

  return <ChallengeClient challenge={item} initialRanking={initialRanking} />;
}
