"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { HomeHeader } from "@/components/HomeHeader";
import { ContentCard } from "@/components/ContentCard";
import { categories as fallbackCategories, type Category, type ContentCardItem } from "@/lib/content";
import { loadMyChats, type MyChatItem } from "@/lib/pananaApp/myChats";

export function HomeClient({ categories }: { categories?: Category[] }) {
  const source = categories?.length ? categories : fallbackCategories;
  const topCategories = source.map((c) => ({
    ...c,
    items: c.items.slice(0, 4),
  }));

  const heroCandidates = useMemo(() => {
    const all = (source || []).flatMap((c) => c.items || []);
    const bySlug = new Map<string, ContentCardItem>();
    for (const it of all) {
      const key = String(it.characterSlug || "").trim();
      if (!key) continue;
      if (!bySlug.has(key)) bySlug.set(key, it);
    }
    return Array.from(bySlug.values()).slice(0, 12);
  }, [source]);

  const [heroList, setHeroList] = useState<ContentCardItem[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [activeTab, setActiveTab] = useState<"my" | "home" | "challenge" | "ranking">("home");
  const [myChats, setMyChats] = useState<MyChatItem[]>([]);

  const hero = heroList[heroIdx] || null;

  const shuffle = <T,>(arr: T[]) => {
    const out = [...arr];
    // cryptographically strong random when available (browser)
    const rnd = (n: number) => {
      try {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return buf[0] % n;
      } catch {
        return Math.floor(Math.random() * n);
      }
    };
    for (let i = out.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  useEffect(() => {
    const fallback: ContentCardItem = {
      id: "home-hero-fallback",
      characterSlug: "seola",
      author: "@spinner",
      title: "여사친 김설아",
      description: "오랜 소꿉친구에게 갑자기 크리스마스에 고백을 해버렸는데...",
      tags: ["#여사친", "#고백공격"],
    };
    const next = shuffle(heroCandidates.length ? heroCandidates : [fallback]);
    setHeroList(next);
    setHeroIdx(0);
    // 접속(마운트)마다 랜덤 순서로 시작
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroCandidates.length]);

  useEffect(() => {
    if (heroPaused) return;
    if (heroList.length <= 1) return;
    const t = window.setInterval(() => {
      setHeroIdx((i) => (heroList.length ? (i + 1) % heroList.length : 0));
    }, 4500);
    return () => window.clearInterval(t);
  }, [heroPaused, heroList.length]);

  useEffect(() => {
    const load = () => {
      const list = loadMyChats();
      setMyChats(list);
      // 대화한 캐릭터가 있으면 첫 진입에 MY를 자동 선택(요청 UX)
      if (list.length) setActiveTab("my");
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.18),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <HomeHeader active={activeTab} showMy={myChats.length > 0} onChange={setActiveTab} />

      <main className="mx-auto w-full max-w-[420px] px-5 pb-10 pt-5">
        {activeTab === "my" && myChats.length ? (
          <div className="mb-6 overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.03]">
            {myChats.slice(0, 20).map((it) => (
              <Link
                key={it.characterSlug}
                href={`/c/${it.characterSlug}/chat`}
                className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 last:border-b-0 hover:bg-white/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                    {it.avatarUrl ? (
                      <Image src={it.avatarUrl} alt="" fill sizes="40px" className="object-cover" />
                    ) : (
                      <Image src="/dumyprofile.png" alt="" fill sizes="40px" className="object-cover opacity-90" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-white/85">{it.characterName}</div>
                    <div className="mt-1 text-[11px] font-semibold text-white/35">@{it.characterSlug}</div>
                  </div>
                </div>
                {/* unread UI는 추후 연결. 지금은 진입 버튼 느낌만 유지 */}
                <div className="flex-none rounded-full bg-panana-pink/20 px-3 py-1 text-[11px] font-extrabold text-[#ffa9d6] ring-1 ring-panana-pink/30">
                  대화
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        {activeTab === "my" && !myChats.length ? (
          <div className="mb-6 rounded-[16px] border border-white/10 bg-white/[0.03] px-5 py-6 text-[13px] font-semibold text-white/60">
            아직 대화한 캐릭터가 없어요. 홈에서 캐릭터를 선택해 대화를 시작해 보세요.
          </div>
        ) : null}

        {activeTab === "my" ? null : (
          <>
        {/* 상단 큰 카드(향후: 공지/추천/바로가기) */}
        <Link
          href={hero ? `/c/${hero.characterSlug}` : "/home"}
          className="group block overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.04] shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
          onFocus={() => setHeroPaused(true)}
          onBlur={() => setHeroPaused(false)}
        >
          <div className="relative aspect-[16/9] w-full">
            {hero?.imageUrl ? (
              <Image
                src={hero.imageUrl}
                alt=""
                fill
                priority
                sizes="(max-width: 420px) 100vw, 420px"
                className="object-cover"
              />
            ) : null}
            {/* 이미지가 없을 때만 placeholder 배경 */}
            {!hero?.imageUrl ? (
              <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_30%_20%,rgba(255,77,167,0.25),transparent_55%),radial-gradient(700px_280px_at_70%_70%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02))]" />
            ) : null}
          </div>
          <div className="p-4">
            <div className="text-[12px] font-semibold text-white/40">{hero?.author || "@panana"}</div>
            <div className="mt-1 text-[18px] font-extrabold tracking-[-0.02em] text-white/90">
              {hero?.title || "추천 콘텐츠"}
            </div>
            <div className="mt-1 text-[12px] leading-[1.55] text-white/55">
              {hero?.description || "지금 바로 확인해보세요."}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-semibold text-[#ffa9d6]">
              {(hero?.tags || []).slice(0, 4).map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>

            {/* rotation dots */}
            {heroList.length > 1 ? (
              <div className="mt-4 flex items-center gap-1.5">
                {heroList.slice(0, 8).map((_, i) => {
                  const active = i === heroIdx;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`상단 배너 ${i + 1}로 이동`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHeroIdx(i);
                        setHeroPaused(true);
                        window.setTimeout(() => setHeroPaused(false), 2500);
                      }}
                      className={[
                        "h-1.5 w-1.5 rounded-full transition",
                        active ? "bg-[#ffa9d6]" : "bg-white/20 hover:bg-white/35",
                      ].join(" ")}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        </Link>

        {/* 카테고리 섹션들 */}
        <div className="mt-8 space-y-10">
          {topCategories.map((cat) => (
            <section key={cat.slug}>
              <div className="flex items-center justify-between">
                <div className="text-[14px] font-semibold tracking-[-0.01em] text-white/75"># {cat.name}</div>
                <Link
                  href={`/category/${cat.slug}`}
                  aria-label={`${cat.name} 전체 보기`}
                  className="p-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 6l6 6-6 6" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {cat.items.slice(0, 4).map((it) => (
                  <ContentCard
                    key={it.id}
                    author={it.author}
                    title={it.title}
                    description={it.description}
                    tags={it.tags}
                    imageUrl={it.imageUrl}
                    href={`/c/${it.characterSlug}`}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
          </>
        )}
      </main>

    </div>
  );
}