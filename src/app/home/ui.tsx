"use client";

import Link from "next/link";
import { HomeHeader } from "@/components/HomeHeader";
import { ContentCard } from "@/components/ContentCard";
import { categories } from "@/lib/content";

export function HomeClient() {
  const topCategories = categories.map((c) => ({
    ...c,
    items: c.items.slice(0, 4),
  }));

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.18),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <HomeHeader />

      <main className="mx-auto w-full max-w-[420px] px-5 pb-10 pt-5">
        {/* 상단 큰 카드(향후: 공지/추천/바로가기) */}
        <div className="overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.04] shadow-[0_18px_42px_rgba(0,0,0,0.45)]">
          <div className="aspect-[16/9] w-full bg-[radial-gradient(900px_320px_at_30%_20%,rgba(255,77,167,0.25),transparent_55%),radial-gradient(700px_280px_at_70%_70%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02))]" />
          <div className="p-4">
            <div className="text-[12px] font-semibold text-white/40">@spinner</div>
            <div className="mt-1 text-[18px] font-extrabold tracking-[-0.02em] text-white/90">여사친 김설아</div>
            <div className="mt-1 text-[12px] leading-[1.55] text-white/55">
              오랜 소꿉친구에게 갑자기 크리스마스에 고백을 해버렸는데...
            </div>
            <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-semibold text-[#ffa9d6]">
              <span>#여사친</span>
              <span>#고백공격</span>
            </div>
          </div>
        </div>

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
                    href={`/c/${it.characterSlug}`}
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