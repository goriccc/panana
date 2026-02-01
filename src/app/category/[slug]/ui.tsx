"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Category, ContentCardItem } from "@/lib/content";
import { ContentCard } from "@/components/ContentCard";
import { fetchAdultStatus } from "@/lib/pananaApp/adultVerification";
import { fetchMyAccountInfo, type Gender } from "@/lib/pananaApp/accountInfo";

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

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function newGenderCacheKey(preferredGender: CharacterGender | null, safetyOn: boolean) {
  if (!preferredGender) return "";
  return `panana_home_category_cache:new:${preferredGender}:${safetyOn ? "1" : "0"}`;
}

function newGenderCacheMetaKey(preferredGender: CharacterGender | null, safetyOn: boolean) {
  if (!preferredGender) return "";
  return `panana_home_category_cache:new:${preferredGender}:${safetyOn ? "1" : "0"}:source`;
}

function categoryCacheKey(
  slug: string,
  preferredGender: CharacterGender | null,
  userGender: Gender | null,
  safetyOn: boolean
) {
  const genderKey = preferredGender ? `pref:${preferredGender}` : "mix";
  return `panana_home_category_cache:${slug}:${genderKey}:${safetyOn ? "1" : "0"}`;
}

function filterKnownGender(items: ContentCardItem[]): ContentCardItem[] {
  return items.filter((it) => {
    const g = getCharacterGender(it);
    return g === "male" || g === "female";
  });
}

function mixByGender(items: ContentCardItem[], seed: number): ContentCardItem[] {
  const male: ContentCardItem[] = [];
  const female: ContentCardItem[] = [];
  const unknown: ContentCardItem[] = [];
  for (const it of items) {
    const g = getCharacterGender(it);
    if (g === "male") male.push(it);
    else if (g === "female") female.push(it);
    else unknown.push(it);
  }
  const sm = shuffleWithSeed(male, seed + 1);
  const sf = shuffleWithSeed(female, seed + 2);
  const su = shuffleWithSeed(unknown, seed + 3);
  const startFemale = (seed % 2) === 0;
  const out: ContentCardItem[] = [];
  let i = 0;
  while (i < sm.length || i < sf.length) {
    if (startFemale) {
      if (i < sf.length) out.push(sf[i]);
      if (i < sm.length) out.push(sm[i]);
    } else {
      if (i < sm.length) out.push(sm[i]);
      if (i < sf.length) out.push(sf[i]);
    }
    i += 1;
    if (su.length && out.length % 2 === 0) {
      out.push(su.shift() as ContentCardItem);
    }
  }
  return out.concat(su);
}

function hasGenderData(items: ContentCardItem[]): boolean {
  return (items || []).some((it) => {
    const g = (it as any)?.gender;
    return g === "male" || g === "female";
  });
}

export function CategoryClient({ category }: { category: Category }) {
  const sp = useSearchParams();
  const source = sp.get("source");
  const [items, setItems] = useState(category.items);
  const [safetyOn, setSafetyOn] = useState(false);
  const [adultVerified, setAdultVerified] = useState(false);
  const [safetyReady, setSafetyReady] = useState(false);
  const effectiveSafetyOn = safetyOn && adultVerified;
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
  const [genderSeed, setGenderSeed] = useState(1);
  const [userGenderLoading, setUserGenderLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem("panana_user_gender");
      if (raw === "female" || raw === "male" || raw === "both" || raw === "private") return false;
      const draftRaw = localStorage.getItem("panana_airport_draft");
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        const g = String(draft?.gender || "");
        if (g === "female" || g === "male" || g === "both" || g === "private") return false;
      }
    } catch {}
    return true;
  });
  const [resetGenderHold, setResetGenderHold] = useState(false);
  const [newGenderLoading, setNewGenderLoading] = useState(false);
  const preferredGender = useMemo(() => preferredCharacterGender(userGender), [userGender]);
  const [paging, setPaging] = useState<{ offset: number; hasMore: boolean; loading: boolean }>({
    offset: category.items.length,
    hasMore: category.items.length >= 12,
    loading: false,
  });
  const [sourceReady, setSourceReady] = useState(() => source !== "home");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const initialItemsRef = useRef(category.items);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSafetyOn(localStorage.getItem("panana_safety_on") === "1");
  }, []);

  useEffect(() => {
    let alive = true;
    fetchAdultStatus().then((status) => {
      if (!alive) return;
      setAdultVerified(Boolean(status?.adultVerified));
      setSafetyReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

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
      .finally(() => {
        if (!alive) return;
        setUserGenderLoading(false);
        setResetGenderHold(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const resetAt = localStorage.getItem("panana_account_info_reset_at");
      const ts = resetAt ? Number(resetAt) : NaN;
      if (!Number.isFinite(ts) || ts <= 0 || Date.now() - ts > 2 * 60 * 1000) return;
      const raw = localStorage.getItem("panana_user_gender");
      if (raw === "female" || raw === "male" || raw === "both" || raw === "private") return;
      const draftRaw = localStorage.getItem("panana_airport_draft");
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        const g = String(draft?.gender || "");
        if (g === "female" || g === "male" || g === "both" || g === "private") return;
      }
      setResetGenderHold(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem("panana_gender_shuffle_seed");
      if (stored) {
        const num = Number(stored);
        if (!Number.isNaN(num) && num > 0) {
          setGenderSeed(num);
          return;
        }
      }
      const next = Math.floor(Math.random() * 100000) + 1;
      localStorage.setItem("panana_gender_shuffle_seed", String(next));
      setGenderSeed(next);
    } catch {
      // ignore
    }
  }, []);

  const displayItems = useMemo(() => {
    const shouldMixGender = userGender === "both" || userGender === "private" || !userGender;
    const isForYou = (slug: string, name: string) => {
      const s = String(slug || "").toLowerCase();
      const n = String(name || "").toLowerCase();
      return s.includes("for-you") || s.includes("for-me") || n.includes("나에게");
    };
    const isPopular = (slug: string, name: string) => {
      const s = String(slug || "").toLowerCase();
      const n = String(name || "").toLowerCase();
      return s.includes("loved") || n.includes("모두에게");
    };

    if (effectiveSafetyOn) {
      const filtered = items.filter((it) => Boolean((it as ContentCardItem).safetySupported));
      const genderFiltered = preferredGender
        ? filtered.filter((it) => getCharacterGender(it) === preferredGender)
        : filtered;
    if (
      shouldMixGender &&
      hasGenderData(genderFiltered) &&
      (isForYou(category.slug, category.name) || isPopular(category.slug, category.name) || category.slug === "new")
    ) {
        const gendered = filterKnownGender(genderFiltered);
        return gendered.length ? mixByGender(gendered, genderSeed) : genderFiltered;
      }
      return genderFiltered;
    }
    const filtered = items.filter((it) => !(it as ContentCardItem).safetySupported);
    const genderFiltered = preferredGender
      ? filtered.filter((it) => getCharacterGender(it) === preferredGender)
      : filtered;
    if (
      shouldMixGender &&
      hasGenderData(genderFiltered) &&
      (isForYou(category.slug, category.name) || isPopular(category.slug, category.name) || category.slug === "new")
    ) {
      const gendered = filterKnownGender(genderFiltered);
      return gendered.length ? mixByGender(gendered, genderSeed) : genderFiltered;
    }
    return genderFiltered;
  }, [items, effectiveSafetyOn, userGender, category.slug, category.name, genderSeed]);

  useEffect(() => {
    if (category.slug !== "new" || !preferredGender) return;
    let alive = true;
    (async () => {
      try {
        const key = newGenderCacheKey(preferredGender, effectiveSafetyOn);
        let cached: ContentCardItem[] | null = null;
        if (key && typeof window !== "undefined") {
          try {
            const metaKey = newGenderCacheMetaKey(preferredGender, effectiveSafetyOn);
            const source = metaKey ? localStorage.getItem(metaKey) : null;
            if (source === "api") {
              const raw = localStorage.getItem(key);
              const parsed = raw ? JSON.parse(raw) : null;
              if (Array.isArray(parsed) && parsed.length) cached = parsed as ContentCardItem[];
            }
          } catch {}
        }
        if (cached?.length) {
          setItems(cached as ContentCardItem[]);
          setNewGenderLoading(false);
        } else {
          setNewGenderLoading(true);
          setItems([]);
        }
        const params = new URLSearchParams({
          slug: "new",
          offset: "0",
          limit: "12",
          safetySupported: String(effectiveSafetyOn),
          gender: preferredGender,
        });
        const res = await fetch(`/api/category-items?${params.toString()}`);
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok || !data?.ok || !Array.isArray(data.items)) return;
        const nextItems = data.items as ContentCardItem[];
        setItems(nextItems);
        setPaging({
          offset: Number(data.nextOffset || nextItems.length),
          hasMore: Boolean(data.hasMore),
          loading: false,
        });
        try {
          const metaKey = newGenderCacheMetaKey(preferredGender, effectiveSafetyOn);
          if (key) localStorage.setItem(key, JSON.stringify(nextItems));
          if (metaKey) localStorage.setItem(metaKey, "api");
        } catch {}
      } catch {
        // ignore
      } finally {
        if (!alive) return;
        setNewGenderLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [category.slug, preferredGender, effectiveSafetyOn]);

  useEffect(() => {
    if (source !== "home") return;
    if (category.slug === "new") {
      if (preferredGender) {
        try {
          const key = newGenderCacheKey(preferredGender, effectiveSafetyOn);
          const metaKey = newGenderCacheMetaKey(preferredGender, effectiveSafetyOn);
          const source = metaKey ? localStorage.getItem(metaKey) : null;
          if (source === "api") {
            const raw = key ? localStorage.getItem(key) : null;
            if (raw) {
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
            }
          }
        } catch {
          // ignore
        }
      }
      setSourceReady(true);
      return;
    }
    try {
      const cacheKey = categoryCacheKey(category.slug, preferredGender, userGender, effectiveSafetyOn);
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
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
      }
    } catch {
      // ignore
    }
    setSourceReady(true);
  }, [category.slug, sp, source, preferredGender, effectiveSafetyOn]);

  useEffect(() => {
    if (source === "home") return;
    setItems(category.items);
    setPaging({
      offset: category.items.length,
      hasMore: category.items.length >= 12,
      loading: false,
    });
    setSourceReady(true);
  }, [category.items, category.slug, source]);

  const loadMore = useCallback(async () => {
    if (paging.loading || !paging.hasMore || loadingRef.current) return;
    loadingRef.current = true;
    setPaging((prev) => ({ ...prev, loading: true }));
    try {
      const offset =
        category.slug === "new"
          ? items.filter((it) =>
              effectiveSafetyOn
                ? Boolean((it as ContentCardItem).safetySupported)
                : !(it as ContentCardItem).safetySupported
            ).length
          : paging.offset;
      const params = new URLSearchParams({
        slug: category.slug,
        offset: String(offset),
        limit: "12",
      });
      if (category.slug === "new") {
        params.set("safetySupported", String(effectiveSafetyOn));
        if (preferredGender) params.set("gender", preferredGender);
      }
      const res = await fetch(`/api/category-items?${params.toString()}`);
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
  }, [category.slug, category.items, paging, effectiveSafetyOn, items]);

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
        {!sourceReady ||
        !safetyReady ||
        userGenderLoading ||
        resetGenderHold ||
        (preferredGender && !hasGenderData(items)) ||
        (category.slug === "new" && preferredGender && newGenderLoading) ||
        (category.slug === "new" && preferredGender && items === initialItemsRef.current) ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[280px] animate-pulse rounded-[8px] bg-white/[0.04]" />
            ))}
          </div>
        ) : (
          <>
        <div className="grid grid-cols-2 gap-3">
          {displayItems.map((it, idx) => (
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
              priority={idx < 12}
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
          </>
        )}
      </main>
    </div>
  );
}

