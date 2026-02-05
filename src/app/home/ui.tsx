"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { HomeHeader } from "@/components/HomeHeader";
import { AlertModal } from "@/components/AlertModal";
import { ContentCard } from "@/components/ContentCard";
import { categories as fallbackCategories, type Category, type ContentCardItem } from "@/lib/content";
import { loadMyChats, type MyChatItem } from "@/lib/pananaApp/myChats";
import { ensurePananaIdentity } from "@/lib/pananaApp/identity";
import { fetchAdultStatus } from "@/lib/pananaApp/adultVerification";
import { fetchMyAccountInfo, type Gender } from "@/lib/pananaApp/accountInfo";
import { useSession } from "next-auth/react";
import type { MenuVisibility } from "@/lib/pananaApp/contentServer";
import {
  buildAnswerSignals,
  defaultRecommendationSettings,
  getBehaviorSignals,
  getOrCreateAbBucket,
  loadRecoCache,
  makeCacheKey,
  mergeRecommendationSettings,
  normalizeTag,
  saveRecoCache,
  trackBehaviorEvent,
  type AirportPref,
  type RecommendationSettings,
} from "@/lib/pananaApp/recommendation";

const defaultMenuVisibility: MenuVisibility = {
  my: true,
  home: true,
  challenge: true,
  ranking: true,
  search: true,
};

function setSafetyCookie(on: boolean) {
  try {
    document.cookie = `panana_safety_on=${on ? "1" : "0"}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}
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

function seedFromSignals(signals: Array<{ tag: string; weight: number }>) {
  if (!signals.length) return 1;
  let seed = 0;
  for (const sig of signals) {
    const t = String(sig.tag || "");
    for (let i = 0; i < t.length; i += 1) {
      seed = (seed * 31 + t.charCodeAt(i)) % 100000;
    }
  }
  return Math.max(1, seed);
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

function filterByPreferredGender(items: ContentCardItem[], preferred: CharacterGender | null): ContentCardItem[] {
  if (!preferred) return items;
  return items.filter((it) => getCharacterGender(it) === preferred);
}

function filterKnownGender(items: ContentCardItem[]): ContentCardItem[] {
  return items.filter((it) => {
    const g = getCharacterGender(it);
    return g === "male" || g === "female";
  });
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

const VALID_TABS = ["my", "home", "challenge", "ranking", "search"] as const;
type TabId = (typeof VALID_TABS)[number];

export function HomeClient({
  categories,
  initialSafetyOn,
  initialMenuVisibility,
  initialRecommendationSettings,
  initialTab,
}: {
  categories?: Category[];
  initialSafetyOn?: boolean;
  initialMenuVisibility?: MenuVisibility;
  initialRecommendationSettings?: RecommendationSettings;
  initialTab?: string | null;
}) {
  const router = useRouter();
  // 클라이언트에서는 localStorage를 우선해 즉시 렌더링 (뒤로가기 시 깜빡임 방지)
  const [safetyOn, setSafetyOn] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("panana_safety_on") === "1";
      } catch {}
    }
    return initialSafetyOn ?? false;
  });
  const [adultVerified, setAdultVerified] = useState(false);
  const [adultLoading, setAdultLoading] = useState(true);
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
  const [genderSeed, setGenderSeed] = useState(1);

  // 쿠키 미설정 시 localStorage 기준으로 쿠키 세팅 (다음 요청 시 서버가 읽도록)
  useLayoutEffect(() => {
    try {
      if (typeof window !== "undefined" && initialSafetyOn === undefined) {
        const v = localStorage.getItem("panana_safety_on") === "1";
        setSafetyCookie(v);
      }
    } catch {}
  }, [initialSafetyOn]);

  // 스파이시 ON일 때 adultVerified 확정 전까지 콘텐츠 숨김 (OFF→ON 깜빡임 완전 방지)
  const safetyReady = !safetyOn || !adultLoading;
  const genderReady = !userGenderLoading && !resetGenderHold;
  const [adultModalOpen, setAdultModalOpen] = useState(false);
  const effectiveSafetyOn = safetyOn && adultVerified;
  const preferredGender = useMemo(() => preferredCharacterGender(userGender), [userGender]);

  const sourceBase = categories?.length ? categories : fallbackCategories;
  const source = useMemo(() => {
    return (sourceBase || [])
      .map((c) => ({
        ...c,
        items: (() => {
          const filtered = (c.items || []).filter((it) =>
            effectiveSafetyOn
              ? Boolean((it as any)?.safetySupported)
              : !(it as any)?.safetySupported
          );
          if (!preferredGender) return filtered;
          return filtered.filter((it) => getCharacterGender(it) === preferredGender);
        })(),
      }))
      .filter((c) => (c.items || []).length > 0);
  }, [effectiveSafetyOn, sourceBase, preferredGender]);
  const allItems = useMemo(() => {
    const all = (source || []).flatMap((c) => c.items || []);
    const bySlug = new Map<string, ContentCardItem>();
    for (const it of all) {
      const key = String(it.characterSlug || "").trim();
      if (!key) continue;
      if (!bySlug.has(key)) bySlug.set(key, it);
    }
    return Array.from(bySlug.values());
  }, [source]);

  const heroCandidates = useMemo(() => allItems.slice(0, 12), [allItems]);

  const [heroList, setHeroList] = useState<ContentCardItem[]>([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const resolvedInitialTab: TabId =
    initialTab && VALID_TABS.includes(initialTab as TabId) ? (initialTab as TabId) : "home";
  const [activeTab, setActiveTab] = useState<TabId>(resolvedInitialTab);
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibility>(
    initialMenuVisibility || defaultMenuVisibility
  );
  const [myChats, setMyChats] = useState<MyChatItem[]>([]);
  const [hasAnyMyChats, setHasAnyMyChats] = useState(false);
  const [myChatsSafetyMap, setMyChatsSafetyMap] = useState<Record<string, boolean>>({});
  const [myChatsLoading, setMyChatsLoading] = useState(true);
  const [airportPref, setAirportPref] = useState<AirportPref | null>(null);
  const [recommendationSettings, setRecommendationSettings] = useState<RecommendationSettings>(
    mergeRecommendationSettings(initialRecommendationSettings || defaultRecommendationSettings)
  );
  const [abBucket, setAbBucket] = useState<"A" | "B">("A");
  const [behaviorSignals, setBehaviorSignals] = useState<Array<{ tag: string; weight: number }>>([]);
  const [cachedPersonalizedSlugs, setCachedPersonalizedSlugs] = useState<string[] | null>(null);
  const [popularSlugs, setPopularSlugs] = useState<string[] | null>(null);
  const [popularReady, setPopularReady] = useState(false);
  const [categoryItemsBySlug, setCategoryItemsBySlug] = useState<Record<string, ContentCardItem[]>>({});
  const [categoryPagingBySlug, setCategoryPagingBySlug] = useState<
    Record<string, { offset: number; hasMore: boolean; loading: boolean }>
  >({});
  const categorySentinelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cardIndexRef = useRef(0);
  const { status } = useSession();
  const loggedIn = status === "authenticated";

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

  // URL tab 쿼리와 동기화 (뒤로가기 시 마이 탭 복원)
  useEffect(() => {
    if (initialTab && VALID_TABS.includes(initialTab as TabId)) {
      setActiveTab(initialTab as TabId);
    }
  }, [initialTab]);

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

  // 메뉴 설정 업데이트 (서버에서 받은 값이 있으면 사용, 없으면 클라이언트에서 다시 로드)
  useEffect(() => {
    if (!initialMenuVisibility || !initialRecommendationSettings) {
      fetch("/api/site-settings")
        .then((res) => res.json())
        .then((data) => {
          if (data.menuVisibility) {
            setMenuVisibility(data.menuVisibility);
          }
          if (data.recommendationSettings) {
            setRecommendationSettings(mergeRecommendationSettings(data.recommendationSettings));
          }
        })
        .catch((err) => {
          console.error("Failed to load site settings:", err);
        });
    }
  }, [initialMenuVisibility, initialRecommendationSettings]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const status = await fetchAdultStatus();
      if (!alive) return;
      const verified = Boolean(status?.adultVerified);
      setAdultVerified(verified);
      setAdultLoading(false);
      if (!verified) {
        setSafetyOn(false);
        try {
          localStorage.setItem("panana_safety_on", "0");
          setSafetyCookie(false);
          router.refresh();
        } catch {}
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setAbBucket(getOrCreateAbBucket(recommendationSettings));
    setBehaviorSignals(getBehaviorSignals(recommendationSettings));
  }, [recommendationSettings]);

  useEffect(() => {
    let alive = true;
    const loadPopular = async () => {
      try {
        if (typeof window !== "undefined") {
          const cached = localStorage.getItem("panana_popular_slugs");
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length) {
                setPopularSlugs(parsed);
                setPopularReady(true);
              }
            } catch {}
          }
        }
        const res = await fetch("/api/popular-characters?limit=24&days=30&recentDays=7");
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (res.ok && data?.ok && Array.isArray(data.items)) {
          const slugs = data.items.map((it: any) => String(it?.slug || "").trim()).filter(Boolean);
          setPopularSlugs(slugs.length ? slugs : null);
          try {
            if (slugs.length) {
              localStorage.setItem("panana_popular_slugs", JSON.stringify(slugs));
            } else {
              localStorage.removeItem("panana_popular_slugs");
            }
          } catch {}
        }
      } catch {
        // ignore
      } finally {
        if (!alive) return;
        setPopularReady(true);
      }
    };
    loadPopular();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const loadFromDraft = () => {
      try {
        const raw = localStorage.getItem("panana_airport_draft");
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data?.purpose && data?.mood && data?.characterType) {
          setAirportPref({
            purpose: String(data.purpose),
            mood: String(data.mood),
            characterType: String(data.characterType),
          });
        }
      } catch {
        // ignore
      }
    };

    const loadFromServer = async () => {
      try {
        const idt = ensurePananaIdentity();
        const pananaId = String(idt.id || "").trim();
        if (!pananaId) return;
        const res = await fetch(`/api/me/airport-response?pananaId=${encodeURIComponent(pananaId)}`);
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (res.ok && data?.ok && data?.response?.purpose && data?.response?.mood && data?.response?.characterType) {
          setAirportPref({
            purpose: String(data.response.purpose),
            mood: String(data.response.mood),
            characterType: String(data.response.characterType),
          });
        }
      } catch {
        // ignore
      }
    };

    loadFromDraft();
    loadFromServer();
    return () => {
      alive = false;
    };
  }, []);

  // 활성 탭이 숨겨진 경우 자동 전환
  useEffect(() => {
    if (!menuVisibility[activeTab]) {
      // 우선순위: home > search > my > challenge > ranking
      const fallbackOrder: Array<"my" | "home" | "challenge" | "ranking" | "search"> = [
        "home",
        "search",
        "my",
        "challenge",
        "ranking",
      ];
      const nextTab = fallbackOrder.find((tab) => menuVisibility[tab]);
      if (nextTab) {
        setActiveTab(nextTab);
      }
    }
  }, [menuVisibility, activeTab]);

  const [searchQ, setSearchQ] = useState("");
  const [searchLimit, setSearchLimit] = useState(8);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const hero = heroList[heroIdx] || null;

  const chunkItems = (items: ContentCardItem[], size = 4) => {
    const out: ContentCardItem[][] = [];
    for (let i = 0; i < items.length; i += size) {
      out.push(items.slice(i, i + size));
    }
    return out.length ? out : [[]];
  };

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
    let firstLoad = true;
    const load = async () => {
      const list = loadMyChats();
      setMyChats(list);
      if (list.length > 0) setHasAnyMyChats(true);
      // /home 진입 시 기본은 HOME 유지
      if (firstLoad) {
        setMyChatsLoading(false);
        firstLoad = false;
      }

      // 각 캐릭터의 safety_supported 정보를 한 번에 가져오기
      if (list.length > 0) {
        try {
          const slugs = list.map((it) => it.characterSlug).filter(Boolean);
          if (slugs.length > 0) {
            const res = await fetch("/api/me/characters-safety", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ slugs }),
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.ok && data?.results) {
              setMyChatsSafetyMap(data.results);
            }
          }
        } catch {
          // ignore
        }
      }

    };
    load();
    const onFocus = () => {
      load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (myChats.length > 0) setHasAnyMyChats(true);
  }, [myChats.length]);

  const searchCandidates = useMemo(() => {
    // heroCandidates는 이미 slug dedupe가 되어있음
    return heroCandidates;
  }, [heroCandidates]);

  const recommendedTags = useMemo(() => ["#현실연애", "#롤플주의", "#고백도전", "#연애감정", "#환승연애"], []);

  const answerSignals = useMemo(
    () => buildAnswerSignals(airportPref, recommendationSettings.mapping),
    [airportPref, recommendationSettings.mapping]
  );

  const combinedSignals = useMemo(() => {
    if (!answerSignals.length) return [];
    return abBucket === "B" ? [...answerSignals, ...behaviorSignals] : [...answerSignals];
  }, [answerSignals, behaviorSignals, abBucket]);

  const cacheKey = useMemo(
    () => makeCacheKey({ bucket: abBucket, safetyOn: effectiveSafetyOn, signals: combinedSignals }),
    [abBucket, effectiveSafetyOn, combinedSignals]
  );

  useEffect(() => {
    const cached = loadRecoCache(cacheKey, recommendationSettings.cacheTtlSec);
    setCachedPersonalizedSlugs(cached && cached.length ? cached : null);
  }, [cacheKey, recommendationSettings.cacheTtlSec]);

  const cachedPersonalizedItems = useMemo(() => {
    if (!cachedPersonalizedSlugs?.length) return null;
    const bySlug = new Map(allItems.map((it) => [it.characterSlug, it]));
    const items = cachedPersonalizedSlugs.map((slug) => bySlug.get(slug)).filter(Boolean) as ContentCardItem[];
    return items.length ? items : null;
  }, [cachedPersonalizedSlugs, allItems]);

  const personalizedItems = useMemo(() => {
    if (!combinedSignals.length) return cachedPersonalizedItems;
    const scored = allItems.map((it, idx) => {
      const tags = (it.tags || []).map(normalizeTag).filter(Boolean);
      const tagSet = new Set(tags);
      let score = 0;
      for (const sig of combinedSignals) {
        const pref = normalizeTag(sig.tag);
        if (!pref) continue;
        for (const t of tagSet) {
          if (t === pref || t.includes(pref) || pref.includes(t)) {
            score += sig.weight;
            break;
          }
        }
      }
      return { it, score, idx };
    });

    const ranked = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.idx - b.idx)
      .map((s) => s.it);

    if (ranked.length > 0) return ranked.slice(0, 12);

    if (answerSignals.length) {
      const answerTagSet = new Set(answerSignals.map((s) => normalizeTag(s.tag)).filter(Boolean));
      const weak = allItems
        .map((it, idx) => {
          const tags = (it.tags || []).map(normalizeTag).filter(Boolean);
          let hits = 0;
          for (const t of tags) {
            for (const sig of answerTagSet) {
              if (!sig) continue;
              if (t === sig || t.includes(sig) || sig.includes(t)) {
                hits += 1;
                break;
              }
            }
          }
          return { it, hits, idx };
        })
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits || a.idx - b.idx)
        .map((x) => x.it);
      if (weak.length) return weak.slice(0, 12);
      return shuffleWithSeed(allItems, seedFromSignals(answerSignals)).slice(0, 12);
    }

    return cachedPersonalizedItems;
  }, [combinedSignals, allItems, cachedPersonalizedItems, answerSignals]);

  useEffect(() => {
    if (!personalizedItems?.length) return;
    const slugs = personalizedItems.map((it) => it.characterSlug).filter(Boolean);
    if (!slugs.length) return;
    saveRecoCache(cacheKey, slugs);
  }, [personalizedItems, cacheKey]);

  const trackBehavior = (type: "click" | "chat_start" | "favorite", tags: string[]) => {
    trackBehaviorEvent({ type, tags, settings: recommendationSettings });
    setBehaviorSignals(getBehaviorSignals(recommendationSettings));
  };

  const isForYou = useCallback((slug: string, name: string) => {
    const s = String(slug || "").toLowerCase();
    const n = String(name || "").toLowerCase();
    return s.includes("for-you") || s.includes("for-me") || n.includes("나에게");
  }, []);
  const isPopular = useCallback((slug: string, name: string) => {
    const s = String(slug || "").toLowerCase();
    const n = String(name || "").toLowerCase();
    return s.includes("loved") || n.includes("모두에게");
  }, []);
  const isNew = useCallback((slug: string, name: string) => {
    const s = String(slug || "").toLowerCase();
    const n = String(name || "").toLowerCase();
    return s === "new" || n.includes("새로 올라온");
  }, []);

  const recentChatItems = useMemo(() => {
    if (!myChats.length) return [];
    const bySlug = new Map(allItems.map((it) => [it.characterSlug, it]));
    return myChats.map((it) => bySlug.get(it.characterSlug)).filter(Boolean) as ContentCardItem[];
  }, [myChats, allItems]);

  const topCategories = useMemo(() => {
    const bySlug = new Map(allItems.map((it) => [it.characterSlug, it]));
    const shouldMixGender = userGender === "both" || userGender === "private" || !userGender;

    return (source || []).map((c) => {
      let items = c.items || [];
      if (isForYou(c.slug, c.name) && personalizedItems?.length) {
        items = personalizedItems;
      } else if (isPopular(c.slug, c.name) && !popularReady) {
        items = [];
      } else if (isPopular(c.slug, c.name) && popularSlugs?.length) {
        const popularItems = popularSlugs.map((slug) => bySlug.get(slug)).filter(Boolean) as ContentCardItem[];
        if (popularItems.length) {
          const fallback = items.filter((it) => !popularItems.find((p) => p.characterSlug === it.characterSlug));
          items = [...popularItems, ...fallback];
        }
      } else if (isPopular(c.slug, c.name) && !popularSlugs?.length) {
        if (recentChatItems.length) {
          const fallback = items.filter((it) => !recentChatItems.find((p) => p.characterSlug === it.characterSlug));
          items = [...recentChatItems, ...fallback];
        } else {
          items = shuffleWithSeed(items, genderSeed + 7);
        }
      }

      if (
        shouldMixGender &&
        hasGenderData(items) &&
        (isForYou(c.slug, c.name) || isPopular(c.slug, c.name) || isNew(c.slug, c.name))
      ) {
        const gendered = filterKnownGender(items);
        items = gendered.length ? mixByGender(gendered, genderSeed) : items;
      }

      return {
        ...c,
        items: items || [],
      };
    });
  }, [source, personalizedItems, popularSlugs, allItems, isForYou, isPopular, userGender, genderSeed, recentChatItems, popularReady]);

  // 선 로드: 첫 12개 썸네일 미리 fetch
  const preloadUrls = useMemo(() => {
    const urls: string[] = [];
    const seen = new Set<string>();
    for (const cat of topCategories) {
      for (const it of cat.items ?? []) {
        const u = (it as ContentCardItem).imageUrl;
        if (u && !seen.has(u)) {
          seen.add(u);
          urls.push(u);
          if (urls.length >= 12) return urls;
        }
      }
    }
    return urls;
  }, [topCategories]);

  useEffect(() => {
    if (!preloadUrls.length || typeof document === "undefined") return;
    const links: HTMLLinkElement[] = [];
    for (const url of preloadUrls) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      document.head.appendChild(link);
      links.push(link);
    }
    return () => links.forEach((l) => l.remove());
  }, [preloadUrls]);

  useEffect(() => {
    const initialLimit = 12;
    setCategoryItemsBySlug((prev) => {
      const next = { ...prev };
      topCategories.forEach((cat) => {
        if (isForYou(cat.slug, cat.name) || isPopular(cat.slug, cat.name)) return;
        if (!next[cat.slug]) next[cat.slug] = cat.items || [];
      });
      return next;
    });
    setCategoryPagingBySlug((prev) => {
      const next = { ...prev };
      topCategories.forEach((cat) => {
        if (isForYou(cat.slug, cat.name) || isPopular(cat.slug, cat.name)) return;
        if (!next[cat.slug]) {
          const count = (cat.items || []).length;
          next[cat.slug] = { offset: count, hasMore: count >= initialLimit, loading: false };
        }
      });
      return next;
    });
  }, [topCategories, isForYou, isPopular]);

  useEffect(() => {
    try {
      topCategories.forEach((cat) => {
        const items = categoryItemsBySlug[cat.slug] || cat.items || [];
        if (cat.slug !== "new") {
          const cacheKey = categoryCacheKey(cat.slug, preferredGender, userGender, effectiveSafetyOn);
          if (!preferredGender || hasGenderData(items)) {
            localStorage.setItem(cacheKey, JSON.stringify(items));
          } else {
            localStorage.removeItem(cacheKey);
          }
        }
      });
    } catch {
      // ignore
    }
  }, [topCategories, categoryItemsBySlug, preferredGender, effectiveSafetyOn]);

  useEffect(() => {
    if (!preferredGender) return;
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
          setCategoryItemsBySlug((prev) => ({ ...prev, new: cached as ContentCardItem[] }));
          setNewGenderLoading(false);
        } else {
          setNewGenderLoading(true);
          setCategoryItemsBySlug((prev) => ({ ...prev, new: [] }));
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
        const items = data.items as ContentCardItem[];
        setCategoryItemsBySlug((prev) => ({ ...prev, new: items }));
        setCategoryPagingBySlug((prev) => ({
          ...prev,
          new: {
            offset: Number(data.nextOffset || items.length),
            hasMore: Boolean(data.hasMore),
            loading: false,
          },
        }));
        try {
          const metaKey = newGenderCacheMetaKey(preferredGender, effectiveSafetyOn);
          if (key) localStorage.setItem(key, JSON.stringify(items));
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
  }, [preferredGender, effectiveSafetyOn]);

  const loadMoreCategoryItems = useCallback(async (slug: string) => {
    const paging = categoryPagingBySlug[slug];
    if (!paging || paging.loading || !paging.hasMore) return;
    setCategoryPagingBySlug((prev) => ({
      ...prev,
      [slug]: { ...paging, loading: true },
    }));
    try {
      const params = new URLSearchParams({
        slug,
        offset: String(paging.offset),
        limit: "12",
      });
      if (slug === "new") {
        params.set("safetySupported", String(effectiveSafetyOn));
        if (preferredGender) params.set("gender", preferredGender);
      }
      const res = await fetch(`/api/category-items?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !Array.isArray(data.items)) {
        throw new Error("failed");
      }
      setCategoryItemsBySlug((prev) => ({
        ...prev,
        [slug]: [...(prev[slug] || []), ...data.items],
      }));
      setCategoryPagingBySlug((prev) => ({
        ...prev,
        [slug]: {
          offset: Number(data.nextOffset || paging.offset),
          hasMore: Boolean(data.hasMore),
          loading: false,
        },
      }));
    } catch {
      setCategoryPagingBySlug((prev) => ({
        ...prev,
        [slug]: { ...paging, loading: false },
      }));
    }
  }, [categoryPagingBySlug, effectiveSafetyOn, preferredGender]);

  const setCategorySentinel = useCallback(
    (slug: string) => (el: HTMLDivElement | null) => {
      categorySentinelRefs.current[slug] = el;
    },
    []
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const slug = entry.target.getAttribute("data-slug") || "";
          if (!slug) return;
          const paging = categoryPagingBySlug[slug];
          if (!paging || paging.loading || !paging.hasMore) return;
          void loadMoreCategoryItems(slug);
        });
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 }
    );

    Object.values(categorySentinelRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [categoryPagingBySlug, loadMoreCategoryItems]);

  const getDisplayItems = (cat: { slug: string; name: string; items: ContentCardItem[] }) => {
    const base =
      isForYou(cat.slug, cat.name) || isPopular(cat.slug, cat.name) || isNew(cat.slug, cat.name)
        ? categoryItemsBySlug[cat.slug] || cat.items || []
        : categoryItemsBySlug[cat.slug] || cat.items || [];
    if (preferredGender && !hasGenderData(base)) return [];
    const genderFiltered = filterByPreferredGender(base, preferredGender);
    if (effectiveSafetyOn) return genderFiltered.filter((it) => Boolean((it as any)?.safetySupported));
    return genderFiltered.filter((it) => !(it as any)?.safetySupported);
  };


  const filtered = useMemo(() => {
    const q = String(searchQ || "").trim().toLowerCase();
    if (!q) return [];
    return searchCandidates.filter((it) => {
      const title = String(it.title || "").toLowerCase();
      const desc = String(it.description || "").toLowerCase();
      const slug = String(it.characterSlug || "").toLowerCase();
      const tags = Array.isArray(it.tags) ? it.tags.join(" ").toLowerCase() : "";
      const author = String(it.author || "").toLowerCase();
      return title.includes(q) || desc.includes(q) || slug.includes(q) || tags.includes(q) || author.includes(q);
    });
  }, [searchCandidates, searchQ]);

  const myTabFiltered = useMemo(() => {
    // safety 정보가 로드되기 전에는 필터링하지 않음 (깜빡임 방지)
    const hasSafetyInfo = myChats.length === 0 || Object.keys(myChatsSafetyMap).length > 0;
    if (!hasSafetyInfo) return [];
    
    return myChats.filter((it) => {
      // 스파이시 OFF(또는 성인 인증 미완료)일 때: safetySupported가 true인 캐릭터는 숨김
      if (!effectiveSafetyOn) {
        const safetySupported = myChatsSafetyMap[it.characterSlug];
        // safety 정보가 없으면 일단 숨김 (안전하게 처리)
        if (safetySupported === true || safetySupported === undefined) return false;
      }
      return true;
    });
  }, [myChats, myChatsSafetyMap, effectiveSafetyOn]);

  useEffect(() => {
    setSearchLimit(8);
  }, [searchQ]);

  useEffect(() => {
    if (activeTab !== "search") return;
    // 탭 클릭 직후 바로 포커스가 들어가야 스샷처럼 테마 핑크 포커싱이 보인다.
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  }, [activeTab]);

  return (
    <div
      className={[
        "min-h-dvh text-white",
        activeTab === "search"
          ? "bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)]"
          : "bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.18),transparent_60%),linear-gradient(#07070B,#0B0C10)]",
      ].join(" ")}
    >
      <HomeHeader
        active={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          // 탭별 URL 업데이트 → 브라우저 뒤로가기 시 올바른 탭 복원
          const url = tab === "home" ? "/home" : `/home?tab=${tab}`;
          router.replace(url);
        }}
        safetyOn={safetyOn}
        onSafetyChange={(next) => {
          if (next && !adultVerified) {
            setAdultModalOpen(true);
            return;
          }
          setSafetyOn(next);
          try {
            localStorage.setItem("panana_safety_on", next ? "1" : "0");
            setSafetyCookie(next);
          } catch {}
        }}
        menuVisibility={menuVisibility}
      />

      <main className="mx-auto w-full max-w-[420px] px-5 pb-10 pt-5">
        {activeTab === "search" ? (
          <div className="pb-10">
            <div
              className={[
                "h-[46px] rounded-full border bg-white/[0.03] px-4 ring-1 transition",
                // 스샷처럼: 기본 상태에서도 테마 핑크가 살짝 보이고, 포커스 때 더 강하게
                "border-panana-pink/25 ring-panana-pink/15",
                "focus-within:border-panana-pink/60 focus-within:ring-panana-pink/40",
              ].join(" ")}
            >
              <div className="flex h-full items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path
                    d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 11-14 0 7 7 0 0114 0z"
                    stroke="rgba(255,77,167,0.92)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="어떤 만남을 찾아볼까요?"
                  className="h-full w-full bg-transparent text-[14px] font-semibold leading-none text-white/85 outline-none placeholder:text-white/25"
                />
                {/* 높이 고정: clear 버튼 공간을 항상 확보 */}
                <div className="h-7 w-7">
                  {searchQ.trim() ? (
                  <button
                    type="button"
                    aria-label="검색어 지우기"
                    onClick={() => setSearchQ("")}
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/10 ring-1 ring-white/10 hover:bg-white/15"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M18 6L6 18" stroke="rgba(255,255,255,0.75)" strokeWidth="2.4" strokeLinecap="round" />
                      <path d="M6 6l12 12" stroke="rgba(255,255,255,0.75)" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                  </button>
                  ) : null}
                </div>
              </div>
            </div>

            {!searchQ.trim() ? (
              <div className="mt-10 text-center">
                <div className="text-[14px] font-extrabold text-white/80">무엇을 찾을지 고민된다면</div>
                <div className="mt-2 text-[12px] font-semibold text-white/45">추천 검색어로 시작해보세요!</div>

                <div className="mt-8 space-y-4 text-[12px] font-extrabold text-panana-pink/90">
                  {recommendedTags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSearchQ(t.replace(/^#/, ""))}
                      className="block w-full text-center"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 space-y-4">
                  {filtered.slice(0, searchLimit).map((it) => {
                    const slug = String(it.characterSlug || "").trim();
                    const name = String(it.title || "").trim() || slug || "캐릭터";
                    const tags = Array.isArray(it.tags) ? it.tags.slice(0, 2) : [];
                    const tagsFull = Array.isArray(it.tags) ? it.tags : [];
                    const img = String(it.imageUrl || "").trim();
                    return (
                      <div key={slug} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Link
                            href={slug ? `/c/${slug}` : "/home"}
                            aria-label={`${name} 상세로 이동`}
                            className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
                            prefetch={true}
                            onMouseEnter={() => slug && router.prefetch(`/c/${slug}`)}
                            onClick={() => {
                              if (tagsFull.length) trackBehavior("click", tagsFull);
                            }}
                          >
                            {img ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={img} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Image src="/dumyprofile.png" alt="" fill sizes="40px" className="object-cover opacity-90" />
                            )}
                          </Link>
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold text-white/85">{name}</div>
                            <div className="mt-1 text-[11px] font-semibold text-[#ff8fc3]">
                              {(tags.length ? tags : ["#추천"]).join("  ")}
                            </div>
                          </div>
                        </div>

                        <Link
                          href={slug ? `/c/${slug}/chat` : "/home"}
                          className="flex-none rounded-xl border border-panana-pink/60 bg-white px-3 py-2 text-[12px] font-extrabold text-panana-pink"
                          prefetch={true}
                          onMouseEnter={() => slug && router.prefetch(`/c/${slug}/chat`)}
                          onClick={() => {
                            if (tagsFull.length) trackBehavior("chat_start", tagsFull);
                          }}
                        >
                          메세지
                        </Link>
                      </div>
                    );
                  })}
                </div>

                {filtered.length > searchLimit ? (
                  <div className="mt-10 text-center">
                    <button
                      type="button"
                      className="text-[13px] font-extrabold text-panana-pink/90"
                      onClick={() => setSearchLimit((v) => v + 8)}
                    >
                      더 보기
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {activeTab === "my" && !loggedIn && !hasAnyMyChats ? (
          <Link
            href="/login?return=/home"
            className="mb-4 block w-full rounded-2xl border border-panana-pink/60 bg-white px-5 py-4 text-center text-[13px] font-extrabold text-panana-pink"
          >
            로그인하고 메세지 관리기능을 이용하기
          </Link>
        ) : null}

        {activeTab === "my" && loggedIn && myChatsLoading ? (
          <div className="mb-6 overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.03]">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex items-center gap-3 border-b border-white/10 px-4 py-4 last:border-b-0">
                <div className="h-10 w-10 rounded-full bg-white/10 ring-1 ring-white/10 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded-full bg-white/10 animate-pulse" />
                  <div className="h-2.5 w-20 rounded-full bg-white/10 animate-pulse" />
                </div>
                <div className="h-6 w-12 rounded-full bg-white/10 ring-1 ring-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === "my" ? (() => {
          return myTabFiltered.length > 0 ? (
            <div className="mb-6 overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.03]">
              {myTabFiltered.slice(0, 20).map((it) => (
              <Link
                key={it.characterSlug}
                href={`/c/${it.characterSlug}/chat?from=my`}
                className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 last:border-b-0 hover:bg-white/[0.03]"
                prefetch={true}
                onMouseEnter={() => router.prefetch(`/c/${it.characterSlug}/chat?from=my`)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-10 w-10 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                    {it.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={it.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
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
          ) : null;
        })() : null}

        {activeTab === "my" && (() => {
          // 대화 이력이 한 번이라도 있으면 빈 상태를 절대 노출하지 않는다.
          return !myChatsLoading && !hasAnyMyChats && myTabFiltered.length === 0;
        })() && loggedIn ? (
          <div className="min-h-[58vh]">
            <div className="flex h-full min-h-[58vh] flex-col items-center justify-center text-center">
              <div className="text-[16px] font-extrabold text-white/85">텅 비어있어요!</div>
              <div className="mt-2 text-[12px] font-semibold text-white/50">마음에 드는 친구와 대화를 시작해보세요!</div>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("home");
                  router.replace("/home");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="mt-8 w-full max-w-[340px] rounded-2xl bg-panana-pink px-6 py-4 text-[14px] font-extrabold text-white"
              >
                홈으로 이동하여 대화 상대 찾아보기
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "my" || activeTab === "search" ? null : !safetyReady || !genderReady ? (
          <div className="space-y-6">
            <div className="aspect-[16/9] w-full animate-pulse rounded-[8px] bg-white/[0.04]" />
            <div className="mt-14 space-y-16">
              {Array.from({ length: 3 }).map((_, i) => (
                <section key={`ready-skel-${i}`} className={i === 0 ? "" : "pt-5"}>
                  <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
                  <div className="mt-4 flex gap-3 overflow-hidden">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="h-[280px] min-w-[calc(50%-6px)] flex-1 animate-pulse rounded-[8px] bg-white/[0.04]" />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <>
        {/* 상단 큰 카드(향후: 공지/추천/바로가기) */}
        <Link
          href={hero ? `/c/${hero.characterSlug}` : "/home"}
          className="group block overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.04] shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
          prefetch={true}
          onMouseEnter={() => {
            setHeroPaused(true);
            if (hero?.characterSlug) {
              router.prefetch(`/c/${hero.characterSlug}`);
            }
          }}
          onClick={() => {
            if (hero?.tags?.length) trackBehavior("click", hero.tags);
          }}
          onMouseLeave={() => setHeroPaused(false)}
          onFocus={() => setHeroPaused(true)}
          onBlur={() => setHeroPaused(false)}
        >
          <div className="relative aspect-[16/9] w-full">
            {hero?.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={hero.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
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
          </div>
        </Link>

        {/* 카테고리 섹션들 - 스파이시 ON일 때 성인 인증 확인 전까지 스켈레톤 (한꺼번에 나타나도록) */}
        <div className="mt-14 space-y-16">
          {safetyOn && adultLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <section key={`skeleton-${i}`} className={i === 0 ? "" : "pt-5"}>
                <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
                <div className="mt-4 flex gap-3 overflow-hidden">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="h-[280px] min-w-[calc(50%-6px)] flex-1 animate-pulse rounded-[8px] bg-white/[0.04]" />
                  ))}
                </div>
              </section>
            ))
          ) : (() => {
            cardIndexRef.current = 0;
            return (
            <div style={{ minHeight: 1 }}>
              {topCategories.map((cat) => {
                const displayItems = getDisplayItems(cat);
                const paging = categoryPagingBySlug[cat.slug];
                const baseItems = categoryItemsBySlug[cat.slug] || cat.items || [];
                const showNewGenderSkeleton = cat.slug === "new" && preferredGender && (newGenderLoading || !hasGenderData(baseItems));
                const showPopularGenderSkeleton =
                  isPopular(cat.slug, cat.name) &&
                  ((!popularReady) || (preferredGender && !hasGenderData(baseItems)));
                return (
                <section key={cat.slug} className="pt-5 first:pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] font-semibold tracking-[-0.01em] text-white/75"># {cat.name}</div>
                    <Link
                      href={`/category/${cat.slug}?source=home`}
                      aria-label={`${cat.name} 전체 보기`}
                      className="p-1"
                      prefetch={true}
                      onMouseEnter={() => router.prefetch(`/category/${cat.slug}`)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M9 6l6 6-6 6"
                          stroke="rgba(255,255,255,0.7)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Link>
                  </div>

                  <div className="mt-4">
                    {showNewGenderSkeleton || showPopularGenderSkeleton ? (
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, j) => (
                          <div key={j} className="h-[280px] animate-pulse rounded-[8px] bg-white/[0.04]" />
                        ))}
                      </div>
                    ) : (
                      <div className="hide-scrollbar flex snap-x snap-mandatory gap-0 overflow-x-auto pb-2">
                      {chunkItems(displayItems, 4).map((group, idx) => (
                        <div key={`${cat.slug}-${idx}`} className="w-full shrink-0 snap-start">
                          <div className="grid grid-cols-2 gap-3">
                            {group.map((it) => {
                              const isPriority = cardIndexRef.current++ < 12;
                              return (
                                <ContentCard
                                  key={it.id}
                                  author={it.author}
                                  title={it.title}
                                  description={it.description}
                                  tags={it.tags}
                                  imageUrl={it.imageUrl}
                                  href={`/c/${it.characterSlug}`}
                                  onClick={() => trackBehavior("click", it.tags || [])}
                                priority={isPriority}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      </div>
                    )}
                  </div>
                  {!isForYou(cat.slug, cat.name) && !isPopular(cat.slug, cat.name) && !isNew(cat.slug, cat.name) ? (
                    <div ref={setCategorySentinel(cat.slug)} data-slug={cat.slug} className="h-1 w-full" />
                  ) : null}
                </section>
              )})}
            </div>
          )})()}
        </div>
          </>
        )}
      </main>

      <AlertModal
        open={adultModalOpen && !adultVerified && !adultLoading}
        title="성인 인증 필요"
        message={"스파이시 콘텐츠를 이용하려면\n성인 인증이 필요해요."}
        cancelHref="/home"
        confirmHref="/adult/verify?return=/home"
        cancelText="나중에"
        confirmText="인증하기"
        maxWidthClassName="max-w-[560px]"
      />
    </div>
  );
}