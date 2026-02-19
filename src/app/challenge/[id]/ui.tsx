"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SurfaceCard } from "@/components/SurfaceCard";
import { fetchAdultStatus } from "@/lib/pananaApp/adultVerification";
import { ensurePananaIdentity } from "@/lib/pananaApp/identity";

function getPananaId(): string {
  return ensurePananaIdentity().id;
}

type Challenge = {
  id: string;
  characterId: string;
  characterSlug: string;
  characterName: string;
  profileImageUrl: string | null;
  hashtags: string[];
  title: string;
  challengeGoal: string;
  challengeSituation: string;
  successKeywords: string[];
  partialMatch: boolean;
};

type Msg = { id: string; from: "bot" | "user"; text: string };

type View = "detail" | "chat" | "success" | "ranking";

type RankingEntry = { rank: number; nickname: string; profileImageUrl: string | null; durationMs: number; completedAt: string };
type MyRank = { rank: number; durationMs: number; completedAt: string } | null;

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

/** 문장 부호 뒤 줄바꿈 추가 (엔터 한 번) */
function formatMessageReadability(text: string): string {
  const s = String(text || "").trim();
  if (!s) return s;
  return s
    .replace(/([.!?。！？])\s+/g, "$1\n")
    .replace(/([。！？])([가-힣])/g, "$1\n$2")
    .replace(/([.!?])([가-힣A-Z])/g, "$1\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 도전 모드용: 지문 ( ) （ ） **...** 제거 후 반환 */
function stripFingerprintForChallenge(text: string): string {
  let s = String(text ?? "").trim();
  if (!s) return s;
  // ( ) （ ） 괄호 안 지문 제거
  s = s.replace(/\([^)]*\)/g, "").replace(/（[^）]*）/g, "");
  // ** ... ** 형태 지문 제거 (여러 줄 포함)
  s = s.replace(/\*\*[\s\S]*?\*\*/g, "");
  s = s.replace(/\n{3,}/g, "\n\n").replace(/\s{2,}/g, " ").trim();
  return s;
}

/** MM:SS:cs (분:초:센티초 2자리) */
function formatDurationRanking(ms: number): string {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}:${cs.toString().padStart(2, "0")}`;
}

export function ChallengeClient({
  challenge,
  initialRanking = [],
}: {
  challenge: Challenge;
  initialRanking?: Array<{ rank: number; nickname: string; profileImageUrl: string | null; durationMs: number; completedAt: string | null }>;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("detail");
  const [successDurationMs, setSuccessDurationMs] = useState<number>(0);
  const [challengeSuccess, setChallengeSuccess] = useState(false);
  const [ranking, setRanking] = useState<RankingEntry[]>(
    initialRanking.map((r) => ({ ...r, completedAt: r.completedAt || "" }))
  );
  const [myRank, setMyRank] = useState<MyRank>(null);
  const [rankingLoading, setRankingLoading] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [currentModelLabel, setCurrentModelLabel] = useState<string | null>(null);
  const [adultVerified, setAdultVerified] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [timerMs, setTimerMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const hasStartedSessionRef = useRef(false);
  const pananaIdRef = useRef("");
  const sessionStartedAtRef = useRef<number | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  messagesRef.current = messages;
  const llmConfigRef = useRef<{
    defaultProvider: string;
    fallbackProvider: string;
    fallbackModel: string;
    settings: Array<{ provider: string; model: string }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/llm/config")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d?.settings) {
          llmConfigRef.current = {
            defaultProvider: d.defaultProvider || "anthropic",
            fallbackProvider: d.fallbackProvider || "gemini",
            fallbackModel: d.fallbackModel || "gemini-2.5-flash",
            settings: d.settings || [],
          };
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const status = await fetchAdultStatus();
      if (!alive) return;
      setAdultVerified(Boolean(status?.adultVerified));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadRanking = useCallback(async () => {
    const hasInitial = ranking.length > 0;
    if (!hasInitial) setRankingLoading(true);
    const pid = pananaIdRef.current || getPananaId();
    const q = pid ? `?pananaId=${encodeURIComponent(pid)}` : "";
    try {
      const res = await fetch(`/api/challenges/${challenge.id}/ranking${q}`);
      const data = await res.json();
      if (data?.ok) {
        setRanking(data.ranking || []);
        setMyRank(data.myRank || null);
      }
    } catch {
      if (!hasInitial) {
        setRanking([]);
        setMyRank(null);
      }
    } finally {
      setRankingLoading(false);
    }
  }, [challenge.id]);

  useEffect(() => {
    ensurePananaIdentity();
    pananaIdRef.current = getPananaId() || "";
  }, []);

  useEffect(() => {
    if (view === "detail" || view === "ranking") loadRanking();
  }, [view, loadRanking]);

  useEffect(() => {
    if (!startedAt || challengeSuccess) return;
    const tick = () => setTimerMs(Date.now() - startedAt);
    tick();
    timerRef.current = window.setInterval(tick, 10);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startedAt, challengeSuccess]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const challengeInputRef = useRef<HTMLDivElement | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(64);
  const lastKeyboardHeightRef = useRef(0);
  const isInputFocusedRef = useRef(false);
  const isAtBottomRef = useRef(true);

  // 일반 대화창과 동일: 메시지/타이핑 변경 시 scrollTop = scrollHeight로 맨 아래 스크롤
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rafId = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(rafId);
  }, [messages.length, showTyping]);

  // 모바일 키보드 감지 및 레이아웃 조정 (일반 채팅과 동일)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let initialHeight = window.innerHeight;
    let focusRafId: number | null = null;
    const calcKeyboardHeight = () => {
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        const viewportBottom = viewport.offsetTop + viewport.height;
        const kh = window.innerHeight - viewportBottom;
        return kh > 20 ? kh : 0;
      }
      return 0;
    };
    const updateKeyboardHeight = () => {
      const next = calcKeyboardHeight();
      if (Math.abs(next - lastKeyboardHeightRef.current) < 2) return;
      lastKeyboardHeightRef.current = next;
      setKeyboardHeight(next);
    };
    const handleFocus = () => {
      isInputFocusedRef.current = true;
      if (focusRafId != null) window.cancelAnimationFrame(focusRafId);
      focusRafId = null;
      const start = performance.now();
      const tick = () => {
        updateKeyboardHeight();
        if (performance.now() - start < 400) focusRafId = window.requestAnimationFrame(tick);
      };
      focusRafId = window.requestAnimationFrame(tick);
      updateKeyboardHeight();
      if (isAtBottomRef.current) endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    };
    const handleBlur = () => {
      isInputFocusedRef.current = false;
      if (focusRafId != null) window.cancelAnimationFrame(focusRafId);
      lastKeyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      initialHeight = window.innerHeight;
    };
    let onViewportChange: (() => void) | null = null;
    if (window.visualViewport) {
      onViewportChange = () => {
        if (!isInputFocusedRef.current && lastKeyboardHeightRef.current === 0) return;
        updateKeyboardHeight();
      };
      window.visualViewport.addEventListener("resize", onViewportChange, { passive: true });
      window.visualViewport.addEventListener("scroll", onViewportChange, { passive: true });
    }
    const input = composerRef.current?.querySelector("input");
    if (input) {
      input.addEventListener("focus", handleFocus, { passive: true });
      input.addEventListener("blur", handleBlur, { passive: true });
    }
    return () => {
      if (window.visualViewport && onViewportChange) {
        window.visualViewport.removeEventListener("resize", onViewportChange);
        window.visualViewport.removeEventListener("scroll", onViewportChange);
      }
      if (input) {
        input.removeEventListener("focus", handleFocus);
        input.removeEventListener("blur", handleBlur);
      }
    };
  }, [view, challengeSuccess]);

  useEffect(() => {
    if (typeof window === "undefined" || view !== "chat" || challengeSuccess) return;
    const el = composerRef.current;
    if (!el) return;
    const update = () => setComposerHeight(Math.max(64, el.getBoundingClientRect().height));
    update();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    return () => { ro?.disconnect(); };
  }, [view, challengeSuccess]);

  const startSession = useCallback(async () => {
    if (hasStartedSessionRef.current) return;
    hasStartedSessionRef.current = true;
    const pid = pananaIdRef.current || getPananaId();
    try {
      const res = await fetch(`/api/challenges/${challenge.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pananaId: pid }),
      });
      const data = await res.json();
      if (data?.ok) {
        setStartedAt(Date.now());
      }
    } catch {
      // ignore
    }
  }, [challenge.id]);

  const sendMessage = useCallback(async () => {
    const text = String(value || "").trim();
    if (!text || sending) return;

    setValue("");
    if (challengeInputRef.current) challengeInputRef.current.innerText = "";
    setErr(null);
    const userMsg: Msg = { id: `u-${Date.now()}`, from: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setShowTyping(true);

    const sessionStartTime = startedAt ?? Date.now();
    if (!startedAt) {
      setStartedAt(sessionStartTime);
      sessionStartedAtRef.current = sessionStartTime;
      await startSession();
    }

    const pid = pananaIdRef.current || getPananaId();
    const idt = ensurePananaIdentity();
    const userNick = String(idt.nickname || idt.handle || "").trim();
    // 최신 메시지(ref) + 새 유저 메시지로 history 구성 (스테일 클로저 방지)
    const nextMessages = [...messagesRef.current, userMsg];
    // API Zod: content.min(1) 이므로 빈/공백만 있는 메시지는 제외 (7~8턴 400 방지)
    const history = nextMessages
      .filter((m) => String(m.text ?? "").trim().length > 0)
      .map((m) => ({
        role: (m.from === "bot" ? "assistant" : "user") as "user" | "assistant",
        content: String(m.text ?? "").trim(),
      }));
    if (history.length === 0) {
      setSending(false);
      setShowTyping(false);
      return;
    }
    const allowUnsafe = (() => {
      try {
        return localStorage.getItem("panana_safety_on") === "1" && adultVerified;
      } catch {
        return false;
      }
    })();
    const cfg = llmConfigRef.current;
    const provider = cfg?.defaultProvider || "anthropic";
    const model = cfg?.settings?.find((s: any) => s.provider === provider)?.model ?? undefined;

    try {
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          ...(model ? { model } : {}),
          messages: history,
          characterSlug: challenge.characterSlug,
          challengeId: challenge.id,
          concise: true,
          allowUnsafe,
          runtime: {
            variables: {
              panana_id: pid,
              ...(userNick ? { user_name: userNick, call_sign: userNick } : {}),
            },
          },
        }),
      });
      const data = await res.json();
      setShowTyping(false);
      if (data?.provider != null && data?.model != null) {
        const p = String(data.provider).toLowerCase();
        const providerLabel = p === "anthropic" ? "Claude" : p === "gemini" ? "Gemini" : p === "deepseek" ? "DeepSeek" : data.provider;
        setCurrentModelLabel(`${providerLabel} · ${String(data.model)}`);
      }
      if (data?.ok && data.text) {
        const botMsg: Msg = { id: `b-${Date.now()}`, from: "bot", text: data.text };
        setMessages((prev) => [...prev, botMsg]);
        messagesRef.current = [...messagesRef.current, botMsg];
        if (data.challengeSuccess) {
          const actualStartedAt = sessionStartedAtRef.current ?? startedAt ?? Date.now();
          const duration = Date.now() - actualStartedAt;
          try {
            await fetch(`/api/challenges/${challenge.id}/complete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pananaId: pid,
                startedAt: new Date(actualStartedAt).toISOString(),
              }),
            });
          } catch {}
          setSuccessDurationMs(duration);
          setChallengeSuccess(true);
          loadRanking();
        }
      } else {
        setErr(data?.error || "응답을 받지 못했어요.");
      }
    } catch (e: any) {
      setShowTyping(false);
      setErr(e?.message || "오류가 발생했어요.");
    } finally {
      setSending(false);
    }
  }, [value, sending, messages, challenge, startedAt, startSession, loadRanking, adultVerified]);

  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);

  const giveUp = useCallback(() => {
    setShowGiveUpConfirm(false);
    router.push("/home?tab=challenge");
    const pid = pananaIdRef.current || getPananaId();
    fetch(`/api/challenges/${challenge.id}/give-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pananaId: pid }),
    }).catch(() => {});
  }, [challenge.id, router]);

  const confirmGiveUp = useCallback(() => {
    setShowGiveUpConfirm(true);
  }, []);

  // 브라우저 뒤로가기(popstate) 방지: chat 뷰에서만 동작
  useEffect(() => {
    if (view !== "chat") return;
    // history에 dummy state를 push하여 뒤로가기를 가로챔
    window.history.pushState({ challengeChat: true }, "");
    const handlePopState = (e: PopStateEvent) => {
      // 뒤로가기 시 다시 dummy state를 push하고 확인 팝업 표시
      window.history.pushState({ challengeChat: true }, "");
      setShowGiveUpConfirm(true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [view]);

  const backHref = "/home?tab=challenge";

  if (view === "detail") {
    const userNickname = ensurePananaIdentity().nickname || "유저닉네임";
    const rawHashtags = (challenge.hashtags || []).slice(0, 5).map((t) => (t.startsWith("#") ? t : `#${t}`));
    const hashtags = rawHashtags.length > 0 ? rawHashtags : ["#여사친", "#고백상황"];
    return (
      <div className="flex min-h-dvh flex-col bg-[linear-gradient(#07070B,#0B0C10)] text-white">
        <header className="shrink-0 flex items-center justify-center border-b border-white/10 bg-[#07070B]/95 py-3 backdrop-blur-sm">
          <div className="flex w-full max-w-[420px] items-center gap-2 px-4">
            <Link href={backHref} className="shrink-0 p-1 text-[#ffa1cc]" aria-label="뒤로">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-extrabold text-[#ffa1cc]">{challenge.title}</h1>
            <button type="button" className="shrink-0 p-1 text-[#ffa1cc]" aria-label="더보기">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="18" r="1.5" fill="currentColor" />
              </svg>
            </button>
          </div>
        </header>

        <main className="mx-auto flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-start gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
              {challenge.profileImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={challenge.profileImageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Image src="/dumyprofile.png" alt="" fill sizes="64px" className="object-cover opacity-90" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-extrabold text-white/90">{challenge.characterName}</div>
              <div className="mt-2 text-[12px] font-semibold text-white/90">도전목표: <span className="text-[#ff4f9a]">{challenge.challengeGoal}</span></div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-2 text-[12px] font-semibold text-[#ffa1cc]">
            {hashtags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setView("chat")}
            className="mt-6 w-full rounded-xl bg-panana-pink px-6 py-4 text-[15px] font-extrabold text-white"
          >
            도전 시작!
          </button>

          {(challenge.challengeSituation || true) ? (
            <div className="mt-6">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
                <span className="text-[13px] font-extrabold text-white/90">도전 상황</span>
              </div>
              <div className="mt-2 text-[12px] font-semibold leading-relaxed text-white/80">
                {challenge.challengeSituation || "15년동안 소꿉친구였던 김하니에게 고백하는 날이다. 나의 마음을 알고 있을것이 분명하데 과연 고백을 받아줄지 의문이다."}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex min-h-0 flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                </svg>
                <span className="text-[13px] font-extrabold text-white/90">유저 랭킹 순위</span>
              </div>
              <button type="button" onClick={() => setView("ranking")} className="p-1" aria-label="전체 보기">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
            {rankingLoading ? (
              <div className="mt-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex h-12 items-center gap-3">
                    <div className="h-6 w-10 animate-pulse rounded bg-white/10" />
                    <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
                    <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
                  </div>
                ))}
              </div>
            ) : ranking.length > 0 ? (
              <div className="mt-4 max-h-[320px] min-h-0 space-y-2 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {ranking.slice(0, 20).map((r) => (
                  <div key={r.rank} className="flex items-center gap-3 rounded bg-[#16161f] px-3 py-2.5">
                    <span className="flex h-7 w-12 shrink-0 items-center justify-center rounded bg-[#ffa1cc] px-2 text-[11px] font-extrabold text-[#c8326f]">
                      {r.rank}위
                    </span>
                    {r.profileImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={r.profileImageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/90">{r.nickname}</span>
                    <span className="shrink-0 text-[11px] font-semibold text-white/70">{formatDurationRanking(r.durationMs)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {myRank && !ranking.some((r) => r.rank === myRank.rank) ? (
              <div className="mt-2 shrink-0">
                <div className="flex items-center gap-3 rounded bg-[#16161f] px-3 py-2.5">
                  <span className="flex h-7 w-12 shrink-0 items-center justify-center rounded bg-[#ff4f9a] px-2 text-[11px] font-extrabold text-[#000000]">
                    {myRank.rank}위
                  </span>
                  <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-panana-pink">{userNickname}</span>
                  <span className="shrink-0 text-[11px] font-semibold text-panana-pink">{formatDurationRanking(myRank.durationMs)}</span>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    );
  }

  if (view === "chat") {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-[linear-gradient(#07070B,#0B0C10)] text-white">
        <style>{`@keyframes pananaDot{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(-4px);opacity:1}}`}</style>
        {/* 키보드 올라와도 스크롤되지 않도록 헤더+도전목표를 뷰포트 고정 */}
        <div className="fixed top-0 left-0 right-0 z-20 flex flex-col bg-[#07070B] shrink-0 overflow-visible pt-[env(safe-area-inset-top)]">
        <header className="flex shrink-0 justify-center border-b border-white/10 bg-[#07070B]/95 py-3 backdrop-blur-sm">
          <div className="flex min-h-[52px] w-full max-w-[420px] items-center px-4">
            <button type="button" onClick={confirmGiveUp} className="shrink-0 p-1 text-[#ffa1cc]" aria-label="뒤로">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="mx-auto flex min-w-0 flex-1 flex-col items-center justify-center gap-0 px-2">
              <span className="w-full truncate text-center text-[16px] font-extrabold leading-tight text-[#ffa1cc]">
                {challenge.characterName}
              </span>
              <span className="text-[11px] text-white/40 mt-0.5" aria-hidden>
                {currentModelLabel ?? "Claude"}
              </span>
            </div>
            <div className="w-10 shrink-0" />
          </div>
        </header>

        {/* 도전목표 바 */}
        <div className="shrink-0 flex justify-center px-4 pb-3 pt-2">
          <div
            className={`flex w-full max-w-[420px] items-center gap-2 rounded-xl px-4 py-3 ${
              challengeSuccess ? "bg-white/10" : "bg-panana-pink"
            }`}
          >
            <span className="flex shrink-0 items-center gap-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={challengeSuccess ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.9)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={challengeSuccess ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.9)"}>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </span>
            <span className={`min-w-0 flex-1 truncate text-[13px] font-extrabold ${challengeSuccess ? "text-white/70" : "text-white"}`}>
              도전목표 : {challenge.challengeGoal}
            </span>
            <span className={`shrink-0 rounded-lg px-2 py-1 font-mono text-[12px] font-extrabold ${challengeSuccess ? "bg-white/10 text-white/70" : "bg-white/25 text-white"}`}>
              {formatDurationRanking(startedAt ? timerMs : 0)}
            </span>
          </div>
        </div>
        </div>
        {/* 헤더+도전목표 높이만큼 공간 확보(키보드 시에도 본문이 가리지 않음) */}
        <div className="shrink-0" style={{ height: "calc(150px + env(safe-area-inset-top, 0px))" }} aria-hidden />

        <main
          ref={scrollRef}
          className="chat-scrollbar mx-auto w-full max-w-[420px] flex-1 min-h-0 overflow-y-auto px-5 pb-4 pt-4"
          style={{
            paddingTop: "16px",
            paddingBottom: challengeSuccess
              ? "320px"
              : `${Math.max(0, keyboardHeight) + Math.max(0, composerHeight) + 12}px`,
            scrollPaddingBottom: challengeSuccess
              ? "320px"
              : `${Math.max(0, keyboardHeight) + Math.max(0, composerHeight) + 12}px`,
          }}
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            isAtBottomRef.current = atBottom;
          }}
        >
          <div className="space-y-3">
          {messages.length === 0 && !showTyping ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-[14px] font-extrabold text-white/70">도전모드가 시작되었습니다.</div>
              <div className="mt-1 text-[13px] font-semibold text-white/50">가장 빠른 시간내 고백에 성공해보세요!</div>
            </div>
          ) : null}
          {messages.map((m) =>
            m.from === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="inline-block w-fit max-w-[290px] rounded-[22px] rounded-br-[10px] bg-panana-pink px-4 py-3 text-[14px] font-semibold leading-[1.45] text-[#0B0C10]">
                  <div className="whitespace-pre-wrap">{formatMessageReadability(m.text)}</div>
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex w-full flex-col gap-2">
                <div className="flex max-w-[320px] items-end gap-2">
                  {challenge.profileImageUrl ? (
                    <button
                      type="button"
                      onClick={() => setAvatarModalOpen(true)}
                      className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10 transition-opacity hover:opacity-80 active:opacity-70"
                      aria-label="프로필 이미지 크게 보기"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={challenge.profileImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  ) : (
                    <div className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10" />
                  )}
                  <div className="rounded-[22px] rounded-bl-[10px] bg-white/[0.06] px-4 py-3 text-[14px] font-semibold leading-[1.45] text-white/80">
                    <div className="whitespace-pre-wrap">{formatMessageReadability(stripFingerprintForChallenge(m.text))}</div>
                  </div>
                </div>
              </div>
            )
          )}
          {showTyping ? (
            <div className="flex w-full justify-start">
              <div className="flex max-w-[320px] items-end gap-2">
                {challenge.profileImageUrl ? (
                  <button
                    type="button"
                    onClick={() => setAvatarModalOpen(true)}
                    className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10 transition-opacity hover:opacity-80 active:opacity-70"
                    aria-label="프로필 이미지 크게 보기"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={challenge.profileImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ) : (
                  <div className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10" />
                )}
                <div className="rounded-[22px] rounded-bl-[10px] bg-white/[0.06] px-4 py-3">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-[pananaDot_1s_infinite] rounded-full bg-white/60" />
                    <span className="h-1.5 w-1.5 animate-[pananaDot_1s_0.15s_infinite] rounded-full bg-white/60" />
                    <span className="h-1.5 w-1.5 animate-[pananaDot_1s_0.3s_infinite] rounded-full bg-white/60" />
                  </span>
                </div>
              </div>
            </div>
          ) : null}
          {challengeSuccess ? (
            <div className="flex justify-center py-4">
              <div className="max-w-[320px] rounded-2xl bg-white/[0.06] px-4 py-3 text-center text-[13px] font-semibold italic text-white/50 ring-1 ring-white/10">
                축하합니다. 당신은 고백에 성공하였습니다!
              </div>
            </div>
          ) : null}
          <div
            ref={endRef}
            style={{
              scrollMarginBottom: challengeSuccess
                ? "320px"
                : `${Math.max(0, keyboardHeight) + Math.max(0, composerHeight) + 12}px`,
            }}
          />
          </div>
        </main>

        {err ? <div className="px-4 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}

        {challengeSuccess ? (
          /* 도전 성공 모달 - 화면 중앙 팝업 */
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
          >
            <div className="w-full max-w-[360px] rounded-2xl bg-panana-pink px-5 py-6 shadow-xl">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">🚀</span>
                <span className="text-[15px] font-extrabold text-white">도전모드 최종 기록</span>
              </div>
              <div className="mt-4 text-[14px] font-semibold text-white">
                최종 기록은 {formatDurationRanking(successDurationMs)}의 기록으로 유저 순위은{" "}
                <span className="font-extrabold">{myRank?.rank ?? "—"}위</span> 입니다!
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setView("ranking")}
                  className="flex-1 rounded-xl bg-white py-3 text-[14px] font-extrabold text-panana-pink hover:bg-white/95"
                >
                  전체 순위 보러가기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setStartedAt(null);
                    setChallengeSuccess(false);
                    sessionStartedAtRef.current = null;
                    hasStartedSessionRef.current = false;
                  }}
                  className="flex-1 rounded-xl bg-[#d91a7a] py-3 text-[14px] font-extrabold text-white shadow-md hover:bg-[#c8186d]"
                >
                  재도전 하기
                </button>
              </div>
            </div>
          </div>
        ) : (
        /* 대화입력창: 일반 채팅과 동일, 지문 입력 버튼만 제외 */
        <div
          ref={composerRef}
          className="fixed left-0 right-0 bottom-0 z-40 border-t border-white/10 bg-[#0B0C10]/90 backdrop-blur"
          style={{
            transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : "translateY(0)",
            paddingBottom: keyboardHeight > 0 ? "8px" : "max(env(safe-area-inset-bottom), 16px)",
          }}
        >
          <div className="mx-auto w-full max-w-[420px] px-5 py-2.5">
            <div className="relative w-full rounded-full border border-panana-pink/35 bg-white/[0.04] py-2 pl-4 pr-11">
              <div
                ref={challengeInputRef}
                role="textbox"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="메시지를 입력하세요"
                aria-label="메시지 입력"
                className="min-h-[1.5rem] w-full bg-transparent text-base font-semibold text-white/70 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-white/30"
                style={{ fontSize: "16px" }}
                onInput={() => {
                  const el = challengeInputRef.current;
                  if (!el) return;
                  const text = (el.innerText ?? "").replace(/\n/g, " ");
                  setValue(text);
                  // 한 줄 유지: 브라우저가 줄바꿈 넣으면 제거
                  if ((el.innerText ?? "").includes("\n")) {
                    el.innerText = text;
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData("text/plain").replace(/\n/g, " ");
                  document.execCommand("insertText", false, text);
                }}
                onKeyDown={(e) => {
                  const composing = (e.nativeEvent as KeyboardEvent & { isComposing?: boolean })?.isComposing;
                  if (composing) return;
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                    if (challengeInputRef.current) {
                      challengeInputRef.current.innerText = "";
                    }
                    setValue("");
                    setTimeout(() => challengeInputRef.current?.focus(), 100);
                  }
                }}
              />
              <button
                type="button"
                aria-label="전송"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  sendMessage();
                  setTimeout(() => challengeInputRef.current?.focus(), 100);
                }}
                disabled={!value.trim() || sending}
                className="absolute right-[1px] top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/send.png" alt="전송" width={20} height={20} className="h-5 w-5 object-contain" />
              </button>
            </div>
          </div>
        </div>
        )}

        {/* 포기 확인 모달 - 마이페이지 서비스 이용 초기화와 동일 스타일 */}
        {showGiveUpConfirm ? (
          <div className="fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
            <div className="absolute inset-0 grid place-items-center px-3">
              <SurfaceCard variant="outglow" className="w-[min(420px,calc(100vw-24px))] p-6">
                <div className="text-center text-[16px] font-semibold text-white/90">정말 포기하시겠어요?</div>
                <div className="mt-4 whitespace-pre-line text-center text-[14px] leading-[1.45] text-white/70">
                  도전을 포기하면 현재 진행 중인 대화 기록이 사라져요.
                </div>
                <div className="mt-6 flex gap-4">
                  <button
                    type="button"
                    onClick={giveUp}
                    className="flex-1 basis-0 whitespace-nowrap rounded-xl bg-white px-4 py-3 text-center text-[15px] font-semibold text-[#0B0C10]"
                  >
                    포기하기
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGiveUpConfirm(false)}
                    className="flex-1 basis-0 whitespace-nowrap rounded-xl bg-panana-pink px-4 py-3 text-center text-[15px] font-semibold text-white"
                  >
                    계속하기
                  </button>
                </div>
              </SurfaceCard>
            </div>
          </div>
        ) : null}

        {/* 프로필 이미지 크게 보기 모달 */}
        {avatarModalOpen && challenge.profileImageUrl ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setAvatarModalOpen(false)}
          >
            <div className="relative mx-4 w-full max-w-[400px]" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setAvatarModalOpen(false)}
                className="absolute -top-10 right-0 z-10 text-white/80 hover:text-white"
                aria-label="닫기"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <div className="relative w-full overflow-hidden rounded-2xl bg-black/40 ring-2 ring-white/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={challenge.profileImageUrl}
                  alt={`${challenge.characterName} 프로필 이미지`}
                  className="h-auto w-full object-contain"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (view === "success") {
    const durationMs = successDurationMs;
    return (
      <div className="min-h-dvh bg-[linear-gradient(#07070B,#0B0C10)] text-white">
        <main className="mx-auto flex max-w-[420px] flex-col items-center px-4 py-16">
          <div className="text-[24px] font-extrabold text-panana-pink">도전 성공!</div>
          <div className="mt-2 text-[14px] font-semibold text-white/70">도전모드 최종 기록</div>
          <div className="mt-6 border border-panana-pink/40 bg-panana-pink/10 px-8 py-6 text-center">
            <div className="font-mono text-[32px] font-extrabold text-panana-pink">{formatDuration(durationMs)}</div>
          </div>
          <div className="mt-10 flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={() => setView("ranking")}
              className="w-full border border-panana-pink/60 bg-panana-pink/20 px-6 py-4 text-center text-[14px] font-extrabold text-panana-pink"
            >
              전체 순위 보러가기
            </button>
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setStartedAt(null);
                sessionStartedAtRef.current = null;
                hasStartedSessionRef.current = false;
                setView("chat");
              }}
              className="w-full bg-panana-pink px-6 py-4 text-[14px] font-extrabold text-white"
            >
              재도전하기
            </button>
          </div>
        </main>
      </div>
    );
  }

  // view === "ranking" - 유저 랭킹 순위 + 내 순위만 넓게 보기
  return (
    <div className="flex min-h-dvh flex-col bg-[linear-gradient(#07070B,#0B0C10)] text-white">
      <header className="shrink-0 flex items-center justify-center border-b border-white/10 bg-[#07070B]/95 py-3 backdrop-blur-sm">
        <div className="flex w-full max-w-[420px] items-center gap-2 px-4">
          <button type="button" onClick={() => setView("detail")} className="shrink-0 p-1 text-[#ffa1cc]" aria-label="뒤로">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="min-w-0 flex-1 text-center text-[16px] font-extrabold text-[#ffa1cc]">유저 랭킹 순위</h1>
          <button type="button" className="shrink-0 p-1 text-[#ffa1cc]" aria-label="더보기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="6" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="18" r="1.5" fill="currentColor" />
            </svg>
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[420px] flex-1 flex-col overflow-hidden px-4 py-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={`min-h-0 flex-1 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              myRank && !ranking.some((r) => r.rank === myRank.rank)
                ? "pb-20"
                : ""
            }`}
          >
            {rankingLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex h-12 items-center gap-3">
                    <div className="h-7 w-10 animate-pulse rounded bg-white/10" />
                    <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
                    <div className="h-4 w-20 animate-pulse rounded bg-white/10" />
                  </div>
                ))}
              </div>
            ) : ranking.length > 0 ? (
              <div className="space-y-2">
                {ranking.map((r) => (
                  <div key={r.rank} className="flex items-center gap-3 rounded bg-[#16161f] px-3 py-2.5">
                    <span className="flex h-7 w-12 shrink-0 items-center justify-center rounded bg-[#ffa1cc] px-2 text-[11px] font-extrabold text-[#c8326f]">
                      {r.rank}위
                    </span>
                    {r.profileImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={r.profileImageUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/90">{r.nickname}</span>
                    <span className="shrink-0 text-[11px] font-semibold text-white/70">{formatDurationRanking(r.durationMs)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-[13px] font-semibold text-white/50">아직 기록이 없어요.</div>
            )}
          </div>
          {myRank && !ranking.some((r) => r.rank === myRank.rank) ? (
            <div className="fixed bottom-0 left-0 right-0 z-10 flex justify-center border-t border-white/10 bg-[linear-gradient(#07070B,#0B0C10)] pb-[max(env(safe-area-inset-bottom),16px)] pt-2">
              <div className="w-full max-w-[420px] px-4">
                <div className="flex items-center gap-3 rounded bg-[#16161f] px-3 py-2.5">
                  <span className="flex h-7 w-12 shrink-0 items-center justify-center rounded bg-[#ff4f9a] px-2 text-[11px] font-extrabold text-[#000000]">
                    {myRank.rank}위
                  </span>
                  <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-panana-pink">
                    {ensurePananaIdentity().nickname || "나"}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-panana-pink">{formatDurationRanking(myRank.durationMs)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
