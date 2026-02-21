"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CharacterProfile } from "@/lib/characters";
import type { ContentCardItem } from "@/lib/content";
import { ContentCard } from "@/components/ContentCard";
import { defaultRecommendationSettings, trackBehaviorEvent } from "@/lib/pananaApp/recommendation";
import { fetchMyAccountInfo, type Gender } from "@/lib/pananaApp/accountInfo";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-[18px] font-bold text-white/90">{value.toLocaleString("ko-KR")}</div>
      <div className="mt-1 text-[11px] font-semibold text-white/40">{label}</div>
    </div>
  );
}

function PhotoTile({ seed }: { seed: string }) {
  return (
    <div
      className="aspect-square w-full rounded-none bg-[radial-gradient(900px_300px_at_30%_20%,rgba(255,77,167,0.18),transparent_55%),radial-gradient(700px_260px_at_70%_70%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02))]"
      data-seed={seed}
      aria-hidden="true"
    />
  );
}

type CharacterGender = "male" | "female" | "unknown";

function getCharacterGender(item: ContentCardItem): CharacterGender {
  const g = (item as any)?.gender;
  if (g === "female" || g === "male") return g;
  return "unknown";
}

function preferredCharacterGender(userGender: Gender | null): CharacterGender | null {
  if (userGender === "male") return "female";
  if (userGender === "female") return "male";
  return null;
}

function hasGenderData(items: ContentCardItem[]): boolean {
  return (items || []).some((it) => {
    const g = (it as any)?.gender;
    return g === "male" || g === "female";
  });
}

export function CharacterClient({
  character,
  recommendedTalkCards,
}: {
  character: CharacterProfile;
  recommendedTalkCards: ContentCardItem[];
}) {
  const router = useRouter();
  const photos = useMemo(() => character.photos, [character.photos]);
  const isEmptyPosts = Number(character.photoCount || 0) <= 0;
  const [userGender, setUserGender] = useState<Gender | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("panana_user_gender");
      if (raw === "female" || raw === "male" || raw === "both" || raw === "private") return raw;
      const draftRaw = localStorage.getItem("panana_airport_draft");
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        const g = String(draft?.gender || "");
        if (g === "female" || g === "male" || g === "both" || g === "private") return g as Gender;
      }
    } catch {}
    return null;
  });
  const preferredGender = useMemo(() => preferredCharacterGender(userGender), [userGender]);
  
  // 주요 링크 프리페칭
  useEffect(() => {
    router.prefetch(`/c/${character.slug}/chat`);
    router.prefetch(`/c/${character.slug}/profile-image`);
  }, [router, character.slug]);

  useEffect(() => {
    let alive = true;
    fetchMyAccountInfo()
      .then((info) => {
        if (!alive) return;
        setUserGender(info?.gender ?? null);
        try {
          if (info?.gender) {
            localStorage.setItem("panana_user_gender", info.gender);
          } else {
            localStorage.removeItem("panana_user_gender");
          }
        } catch {}
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const filteredRecommendedCards = useMemo(() => {
    if (!preferredGender) return recommendedTalkCards;
    if (!hasGenderData(recommendedTalkCards)) return [];
    return recommendedTalkCards.filter((it) => getCharacterGender(it) === preferredGender);
  }, [preferredGender, recommendedTalkCards]);

  const [safetyOn, setSafetyOn] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const v = document.cookie.split("; ").find((r) => r.startsWith("panana_safety_on="));
        setSafetyOn(v ? v.split("=")[1] === "1" : localStorage.getItem("panana_safety_on") === "1");
      } catch {
        setSafetyOn(false);
      }
    };
    read();
    window.addEventListener("panana-safety-change", read as EventListener);
    return () => window.removeEventListener("panana-safety-change", read as EventListener);
  }, []);
  const headerAccent = safetyOn ? "text-panana-pink2" : "text-[#ffa9d6]";

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <style>{`
        @keyframes pananaPulse {
          0%, 100% { transform: scale(1); opacity: .55; }
          50% { transform: scale(1.035); opacity: 1; }
        }
        @keyframes pananaCtaFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.5px); }
        }
        @keyframes pananaCtaGlow {
          0%, 100% { opacity: .22; transform: scale(0.98); }
          50% { opacity: .45; transform: scale(1.06); }
        }
        @keyframes pananaCtaGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      {/* top bar */}
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link href="/home" aria-label="뒤로가기" className={`absolute left-0 p-2 ${headerAccent}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-current">
              <path
                d="M15 6l-6 6 6 6"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <div className={`mx-auto text-[18px] font-semibold tracking-[-0.01em] ${headerAccent}`}>
            {character.name}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[420px] px-5 pb-16 pt-2">
        {/* profile row */}
        <div className="mt-2">
          <div className="flex items-center gap-4">
            <Link
              href={`/c/${character.slug}/profile-image`}
              aria-label="프로필 이미지 보기"
              className="relative block h-[56px] w-[56px] overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
              prefetch={true}
              onMouseEnter={() => router.prefetch(`/c/${character.slug}/profile-image`)}
            >
              {character.profileImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={character.profileImageUrl}
                  alt={`${character.name} 프로필`}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </Link>

            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-white">{character.name}</div>
              <div className="mt-1 flex items-center gap-5">
                <Link 
                  href={`/c/${character.slug}/follows?tab=followers`} 
                  aria-label="팔로워 목록"
                  prefetch={true}
                  onMouseEnter={() => router.prefetch(`/c/${character.slug}/follows`)}
                >
                  <Stat value={character.followers} label="팔로워" />
                </Link>
                <Link 
                  href={`/c/${character.slug}/follows?tab=following`} 
                  aria-label="팔로잉 목록"
                  prefetch={true}
                  onMouseEnter={() => router.prefetch(`/c/${character.slug}/follows`)}
                >
                  <Stat value={character.following} label="팔로잉" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-semibold text-panana-pink2">
            {character.hashtags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="rounded-xl bg-[#e5e5eb] px-4 py-3 text-center text-[14px] font-semibold text-[#0B0C10]"
            >
              팔로우
            </button>
            <Link
              href={`/c/${character.slug}/chat`}
              className="group relative overflow-hidden rounded-xl bg-panana-pink2 px-4 py-3 text-center text-[14px] font-extrabold text-white ring-2 ring-panana-pink2/25 transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-panana-pink2/40"
              prefetch={true}
              onMouseEnter={() => router.prefetch(`/c/${character.slug}/chat`)}
              onClick={() => {
                if (character.hashtags?.length) {
                  trackBehaviorEvent({
                    type: "chat_start",
                    tags: character.hashtags,
                    settings: defaultRecommendationSettings,
                  });
                }
              }}
              style={{
                boxShadow: "0 18px 46px color-mix(in srgb, var(--panana-pink2) 26%, transparent)",
              }}
            >

              <span className="relative z-10 inline-flex items-center justify-center gap-2">
                메시지
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/15 ring-1 ring-white/20 transition-transform group-hover:translate-x-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M13 5l7 7-7 7"
                      stroke="rgba(255,255,255,0.92)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 12h14"
                      stroke="rgba(255,255,255,0.92)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </span>
            </Link>
          </div>
        </div>

        {/* intro */}
        <div className="mt-5">
          <div className="text-[13px] font-extrabold tracking-[-0.01em] text-white/85">{character.introTitle}</div>
          <div className="mt-2 whitespace-pre-line text-[12px] leading-[1.65] text-white/60">
            {character.introLines.join("\n")}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[13px] font-extrabold tracking-[-0.01em] text-white/85">{character.moodTitle}</div>
          <div className="mt-2 whitespace-pre-line text-[12px] leading-[1.65] text-white/60">
            {character.moodLines.join("\n")}
          </div>
        </div>

        {/* photos */}
        <div className="mt-8">
          <div className="text-[13px] font-extrabold tracking-[-0.01em] text-white/85">
            {character.photoCount}개의 게시물이 있어요.
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <PhotoTile key={p.id} seed={p.id} />
            ))}
          </div>
        </div>

        {/* 추천 섹션: 게시물 0개일 때 태그 유사 카드 */}
        {isEmptyPosts && filteredRecommendedCards.length ? (
          <div className="mt-10">
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-white/75"># 이런 대화는 어때?</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {filteredRecommendedCards.map((it) => (
                <ContentCard
                  key={it.id}
                  href={`/c/${it.characterSlug}`}
                  author={it.author}
                  title={it.title}
                  description={it.description}
                  tags={it.tags}
                  imageUrl={it.imageUrl}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* sections */}
        <div className="mt-10 space-y-10">
          {character.sections.map((s) => (
            <section key={s.title}>
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-white/75">{s.title}</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {s.items.map((it) => (
                  <ContentCard
                    key={it.id}
                    author={it.author}
                    title={it.title}
                    description={it.description}
                    tags={it.tags}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

