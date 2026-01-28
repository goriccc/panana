"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { HomeHeader } from "@/components/HomeHeader";
import { ContentCard } from "@/components/ContentCard";
import { categories as fallbackCategories, type Category, type ContentCardItem } from "@/lib/content";
import { loadMyChats, type MyChatItem } from "@/lib/pananaApp/myChats";
import { useSession } from "next-auth/react";
import type { MenuVisibility } from "@/lib/pananaApp/contentServer";

const defaultMenuVisibility: MenuVisibility = {
  my: true,
  home: true,
  challenge: true,
  ranking: true,
  search: true,
};

export function HomeClient({
  categories,
  initialMenuVisibility,
}: {
  categories?: Category[];
  initialMenuVisibility?: MenuVisibility;
}) {
  const router = useRouter();
  // localStorage에서 즉시 읽어와서 초기 상태 설정 (깜빡임 방지)
  const [safetyOn, setSafetyOn] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("panana_safety_on") === "1";
    } catch {
      return false;
    }
  });

  const sourceBase = categories?.length ? categories : fallbackCategories;
  const source = useMemo(() => {
    if (!safetyOn) return sourceBase;
    // 스파이시 ON: 스파이시 지원 캐릭터만 노출(홈/찾기 공통)
    return (sourceBase || [])
      .map((c) => ({
        ...c,
        items: (c.items || []).filter((it) => Boolean((it as any)?.safetySupported)),
      }))
      .filter((c) => (c.items || []).length > 0);
  }, [safetyOn, sourceBase]);
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
  const [activeTab, setActiveTab] = useState<"my" | "home" | "challenge" | "ranking" | "search">("home");
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibility>(
    initialMenuVisibility || defaultMenuVisibility
  );
  const [myChats, setMyChats] = useState<MyChatItem[]>([]);
  const [hasAnyMyChats, setHasAnyMyChats] = useState(false);
  const [myChatsSafetyMap, setMyChatsSafetyMap] = useState<Record<string, boolean>>({});
  const [myChatsLoading, setMyChatsLoading] = useState(true);
  const { status } = useSession();
  const loggedIn = status === "authenticated";

  // 메뉴 설정 업데이트 (서버에서 받은 값이 있으면 사용, 없으면 클라이언트에서 다시 로드)
  useEffect(() => {
    if (!initialMenuVisibility) {
      fetch("/api/site-settings")
        .then((res) => res.json())
        .then((data) => {
          if (data.menuVisibility) {
            setMenuVisibility(data.menuVisibility);
          }
        })
        .catch((err) => {
          console.error("Failed to load menu visibility:", err);
        });
    }
  }, [initialMenuVisibility]);

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
      // 대화한 캐릭터가 있으면 첫 진입에 MY를 자동 선택(요청 UX)
      if (list.length) setActiveTab("my");
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
      // 스파이시 OFF(safetyOn=false)일 때: safetySupported가 true인 캐릭터는 숨김
      if (!safetyOn) {
        const safetySupported = myChatsSafetyMap[it.characterSlug];
        // safety 정보가 없으면 일단 숨김 (안전하게 처리)
        if (safetySupported === true || safetySupported === undefined) return false;
      }
      return true;
    });
  }, [myChats, myChatsSafetyMap, safetyOn]);

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
        onChange={setActiveTab}
        safetyOn={safetyOn}
        onSafetyChange={(next) => {
          setSafetyOn(next);
          try {
            localStorage.setItem("panana_safety_on", next ? "1" : "0");
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
                          >
                            {img ? (
                              <Image src={img} alt="" fill sizes="40px" className="object-cover" />
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
                href={`/c/${it.characterSlug}/chat`}
                className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 last:border-b-0 hover:bg-white/[0.03]"
                prefetch={true}
                onMouseEnter={() => router.prefetch(`/c/${it.characterSlug}/chat`)}
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
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="mt-8 w-full max-w-[340px] rounded-2xl bg-panana-pink px-6 py-4 text-[14px] font-extrabold text-white"
              >
                홈으로 이동하여 대화 상대 찾아보기
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "my" || activeTab === "search" ? null : (
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
                  prefetch={true}
                  onMouseEnter={() => router.prefetch(`/category/${cat.slug}`)}
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