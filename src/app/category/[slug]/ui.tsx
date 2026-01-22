"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Category, ContentCardItem } from "@/lib/content";
import { ContentCard } from "@/components/ContentCard";

export function CategoryClient({ category }: { category: Category }) {
  const items = useMemo(() => category.items, [category.items]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.14),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link href="/home" aria-label="뒤로가기" className="absolute left-0 p-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 6l-6 6 6 6"
                stroke="rgba(255,169,214,0.98)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <div className="mx-auto text-[18px] font-semibold tracking-[-0.01em] text-[#ffa9d6]">
            {category.name}
          </div>

          <button type="button" aria-label="더보기" className="absolute right-0 p-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 6.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM12 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM12 20.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                fill="rgba(255,169,214,0.92)"
              />
            </svg>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[420px] px-5 pb-14 pt-5">
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            // Category.items는 ContentCardItem 구조
            // (어드민 연동 전이므로 여기서 캐릭터 슬러그로 프로필 이동)
            <ContentCard
              key={(it as ContentCardItem).id}
              author={(it as ContentCardItem).author}
              title={(it as ContentCardItem).title}
              description={(it as ContentCardItem).description}
              tags={(it as ContentCardItem).tags}
              imageUrl={(it as ContentCardItem).imageUrl}
              href={`/c/${(it as ContentCardItem).characterSlug}`}
            />
          ))}
        </div>

        <div className="mt-10 text-center">
          <div className="text-[12px] font-semibold text-white/35">더 많은 콘텐츠를 기대해 주세요!</div>
          <Link
            href="/home"
            className="mt-4 inline-block text-[12px] font-semibold text-panana-pink/85"
          >
            메인 화면으로 이동
          </Link>
        </div>
      </main>
    </div>
  );
}

