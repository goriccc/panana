"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Category, ContentCardItem } from "@/lib/content";
import { ContentCard } from "@/components/ContentCard";

export function CategoryClient({ category }: { category: Category }) {
  const sp = useSearchParams();
  const source = sp.get("source");
  const [items, setItems] = useState(category.items);
  const [paging, setPaging] = useState<{ offset: number; hasMore: boolean; loading: boolean }>({
    offset: category.items.length,
    hasMore: category.items.length >= 12,
    loading: false,
  });
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  useEffect(() => {
    if (source !== "home") return;
    if (category.slug === "new") return;
    try {
      const raw = localStorage.getItem(`panana_home_category_cache:${category.slug}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        const nextItems = parsed as ContentCardItem[];
        setItems(nextItems);
        setPaging({
          offset: nextItems.length,
          hasMore: nextItems.length >= 12,
          loading: false,
        });
      }
    } catch {
      // ignore
    }
  }, [category.slug, sp]);

  useEffect(() => {
    if (source === "home") return;
    setItems(category.items);
    setPaging({
      offset: category.items.length,
      hasMore: category.items.length >= 12,
      loading: false,
    });
  }, [category.items, category.slug, source]);

  const loadMore = useCallback(async () => {
    if (paging.loading || !paging.hasMore || loadingRef.current) return;
    loadingRef.current = true;
    setPaging((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(
        `/api/category-items?slug=${encodeURIComponent(category.slug)}&offset=${paging.offset}&limit=12`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !Array.isArray(data.items)) {
        throw new Error("failed");
      }
      const nextItems = data.items as ContentCardItem[];
      if (nextItems.length) {
        setItems((prev) => [...prev, ...nextItems]);
      }
      // 방어적으로: 아이템이 0개면 더 이상 불러올 게 없다고 간주(무한 로딩/깜빡임 방지)
      const nextHasMore = nextItems.length > 0 && Boolean(data.hasMore);
      setPaging({
        offset: Number(data.nextOffset || paging.offset),
        hasMore: nextHasMore,
        loading: false,
      });
    } catch {
      // 에러가 반복되면 화면이 흔들리므로 더 이상 로딩 시도하지 않음
      setPaging((prev) => ({ ...prev, loading: false, hasMore: false }));
    } finally {
      loadingRef.current = false;
    }
  }, [category.slug, paging]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (!paging.hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          void loadMore();
        });
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, paging.hasMore]);

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
        {paging.loading ? (
          <div className="mt-6 flex h-6 items-center justify-center">
            <div className="text-[12px] font-semibold text-white/45">더 불러오는 중...</div>
          </div>
        ) : null}
        <div ref={sentinelRef} className="h-2 w-full" />

        <div className="mt-10 text-center">
          <div className={`text-[12px] font-semibold text-white/35 ${paging.hasMore ? "opacity-0" : "opacity-100"}`}>
            더 많은 콘텐츠를 기대해 주세요!
          </div>
          <Link
            href="/home"
            className={`mt-4 inline-block text-[12px] font-semibold text-panana-pink/85 ${paging.hasMore ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          >
            메인 화면으로 이동
          </Link>
        </div>
      </main>
    </div>
  );
}

