"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMyUserProfile } from "@/lib/pananaApp/userProfiles";
import { loadRuntime, saveRuntime } from "@/lib/pananaApp/chatRuntime";
import { recordMyChat } from "@/lib/pananaApp/myChats";
import { loadChatHistory, saveChatHistory } from "@/lib/pananaApp/chatHistory";
import { ensurePananaIdentity, setPananaId } from "@/lib/pananaApp/identity";
import { fetchAdultStatus } from "@/lib/pananaApp/adultVerification";
import type { ChatRuntimeEvent, ChatRuntimeState } from "@/lib/studio/chatRuntimeEngine";

type Msg = {
  id: string;
  from: "bot" | "user" | "system";
  text: string;
  sceneImageUrl?: string;
  sceneImageLoading?: boolean;
  sceneImageError?: string;
};
type Provider = "anthropic" | "gemini" | "deepseek";

const PROVIDERS: Array<{ key: Provider; label: string }> = [
  { key: "anthropic", label: "Claude" },
  { key: "gemini", label: "Gemini" },
  { key: "deepseek", label: "DeepSeek" },
];

function getSavedProvider(): Provider {
  try {
    const v = localStorage.getItem("panana_llm_provider");
    if (v === "anthropic" || v === "gemini" || v === "deepseek") return v;
  } catch {}
  return "anthropic";
}

function saveProvider(p: Provider) {
  try {
    localStorage.setItem("panana_llm_provider", p);
  } catch {}
}

function renderChatText(text: string) {
  const lines = String(text || "").split("\n");
  return (
    <div className="whitespace-pre-wrap">
      {lines.map((line, idx) => {
        const raw = String(line);
        const trimmed = raw.trim();
        if (!trimmed) return <div key={idx}>&nbsp;</div>;

        if (trimmed.startsWith("(") && trimmed.includes(")")) {
          const closeIdx = trimmed.indexOf(")");
          const nar = trimmed.slice(0, closeIdx + 1);
          const rest = trimmed.slice(closeIdx + 1).trim();
          return (
            <div key={idx}>
              <div className="text-white/45 italic">{nar}</div>
              {rest ? <div className="text-white/80">{rest}</div> : null}
            </div>
          );
        }

        return (
          <div key={idx} className="text-white/80">
            {raw}
          </div>
        );
      })}
    </div>
  );
}

function Bubble({
  from,
  text,
  avatarUrl,
  onAvatarClick,
  sceneImageUrl,
  sceneImageLoading,
  sceneImageError,
  onGenerateImage,
  onSceneImageClick,
  sceneImageQuota,
  prevUserMsg,
}: {
  from: Msg["from"];
  text: string;
  avatarUrl?: string;
  onAvatarClick?: () => void;
  sceneImageUrl?: string;
  sceneImageLoading?: boolean;
  sceneImageError?: string;
  onGenerateImage?: (userMsg: string, botMsg: string) => void;
  onSceneImageClick?: (url: string) => void;
  sceneImageQuota?: { remaining: number; dailyLimit: number } | null;
  prevUserMsg?: string;
}) {
  const [imgLoadError, setImgLoadError] = useState(false);
  useEffect(() => {
    if (sceneImageUrl) setImgLoadError(false);
  }, [sceneImageUrl]);
  if (from === "user") {
    return (
      <div className="flex justify-end">
        <div className="inline-block w-fit max-w-[290px] rounded-[22px] rounded-br-[10px] bg-panana-pink px-4 py-3 text-[14px] font-semibold leading-[1.45] text-[#0B0C10]">
          {renderChatText(text)}
        </div>
      </div>
    );
  }

  if (from === "system") {
    return (
      <div className="flex justify-center">
        <div className="max-w-[320px] rounded-2xl bg-white/[0.06] px-4 py-2 text-center text-[12px] font-semibold text-white/70 ring-1 ring-white/10">
          {renderChatText(text)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex max-w-[320px] items-end gap-2">
        {avatarUrl && onAvatarClick ? (
          <button
            type="button"
            onClick={onAvatarClick}
            className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10 transition-opacity hover:opacity-80 active:opacity-70"
            aria-label="프로필 이미지 크게 보기"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </button>
        ) : (
          <div className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : null}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <div className="rounded-[22px] rounded-bl-[10px] bg-white/[0.06] px-4 py-3 text-[14px] font-semibold leading-[1.45] text-white/80">
            {renderChatText(text)}
          </div>
          {sceneImageError ? (
            <div className="text-[11px] font-semibold text-[#ff9aa1]">{sceneImageError}</div>
          ) : null}
          {onGenerateImage && !sceneImageUrl && sceneImageQuota && sceneImageQuota.remaining > 0 ? (
            <button
              type="button"
              onClick={() => onGenerateImage(prevUserMsg || "", text)}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-panana-pink/40 bg-panana-pink/15 px-3 py-1.5 text-[11px] font-extrabold text-panana-pink transition hover:bg-panana-pink/25"
            >
              <span className="font-bold">
                {sceneImageQuota.remaining}/{sceneImageQuota.dailyLimit}
              </span>
              이미지생성
            </button>
          ) : null}
        </div>
      </div>
      {sceneImageLoading ? (
        <div className="inline-flex w-fit max-w-[280px] items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
          <div className="relative h-1 w-14 shrink-0 overflow-hidden rounded-full bg-white/10">
            <div className="absolute h-full w-1/3 animate-scene-loading rounded-full bg-panana-pink" />
          </div>
          <span className="whitespace-nowrap text-[11px] font-semibold text-white/70">장면 이미지 생성 중...</span>
        </div>
      ) : sceneImageUrl ? (
        <div className="flex max-w-[320px] items-end gap-0.5">
          {imgLoadError ? (
            <div className="flex max-w-[280px] flex-col items-center justify-center gap-2 rounded-xl bg-white/[0.04] px-4 py-6">
              <span className="text-[11px] font-semibold text-white/50">이미지를 불러올 수 없어요</span>
              {onGenerateImage && prevUserMsg ? (
                <button
                  type="button"
                  onClick={() => {
                    setImgLoadError(false);
                    onGenerateImage(prevUserMsg, text);
                  }}
                  className="rounded-full border border-panana-pink/40 bg-panana-pink/15 px-3 py-1.5 text-[11px] font-bold text-panana-pink"
                >
                  다시 생성
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSceneImageClick?.(sceneImageUrl)}
              className="relative block max-w-[280px] overflow-hidden rounded-xl bg-white/[0.04] transition-opacity hover:opacity-90 active:opacity-80"
              aria-label="장면 이미지 크게 보기"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sceneImageUrl}
                alt="장면 이미지"
                className="aspect-[4/3] w-full max-w-[280px] object-cover"
                referrerPolicy="no-referrer"
                onError={() => setImgLoadError(true)}
              />
            </button>
          )}
          {!imgLoadError && onGenerateImage && prevUserMsg ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateImage(prevUserMsg, text);
              }}
              className="flex h-9 w-9 flex-none items-center justify-center text-panana-pink transition hover:text-panana-pink/80"
              aria-label="이미지 재생성"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TypingDots({ avatarUrl, onAvatarClick }: { avatarUrl?: string; onAvatarClick?: () => void }) {
  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-[320px] items-end gap-2">
        {avatarUrl && onAvatarClick ? (
          <button
            type="button"
            onClick={onAvatarClick}
            className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10 transition-opacity hover:opacity-80 active:opacity-70"
            aria-label="프로필 이미지 크게 보기"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </button>
        ) : (
          <div className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : null}
          </div>
        )}
        <div className="rounded-[22px] rounded-bl-[10px] bg-white/[0.06] px-4 py-3 text-[14px] font-semibold leading-[1.45] text-white/80">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-[pananaDot_1s_infinite] rounded-full bg-white/60" />
            <span className="h-1.5 w-1.5 animate-[pananaDot_1s_0.15s_infinite] rounded-full bg-white/60" />
            <span className="h-1.5 w-1.5 animate-[pananaDot_1s_0.3s_infinite] rounded-full bg-white/60" />
          </span>
        </div>
      </div>
    </div>
  );
}

function varLabelKo(v: string, overrides?: Record<string, string>): string | null {
  const key = String(v || "").trim().toLowerCase();
  const o = overrides || {};
  if (o[key]) return String(o[key]);
  const map: Record<string, string> = {
    affection: "호감도",
    affection_score: "호감도",
    risk: "위험도",
    trust: "신뢰",
    submission: "복종",
    dependency: "의존",
    suspicion: "의심",
    sales: "실적",
    debt: "빚",
    stress: "스트레스",
    contract: "계약확률",
  };
  return map[key] || null;
}

export function CharacterChatClient({
  characterName,
  characterSlug,
  backHref,
  characterAvatarUrl,
  safetySupported,
}: {
  characterName: string;
  characterSlug: string;
  backHref: string;
  characterAvatarUrl?: string;
  safetySupported: boolean | null;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [adultVerified, setAdultVerified] = useState(false);
  const [adultLoading, setAdultLoading] = useState(true);
  const [userName, setUserName] = useState<string>(() => {
    // 템플릿 변수(user_name/call_sign) 치환이 항상 되도록: 로컬 identity 닉네임을 즉시 기본값으로 사용
    try {
      const idt = ensurePananaIdentity();
      return String(idt.nickname || "").trim();
    } catch {
      return "";
    }
  });
  const [varLabels, setVarLabels] = useState<Record<string, string>>({});
  const [rt, setRt] = useState<ChatRuntimeState>({
    variables: {},
    participants: [],
    lastActiveAt: null,
    firedAt: {},
  });

  const endRef = useRef<HTMLDivElement | null>(null);
  const pananaIdRef = useRef<string>("");
  const savedMsgIdsRef = useRef<Set<string>>(new Set());
  const lastPersistedAtRef = useRef<number>(0);
  const warnedDbRef = useRef<boolean>(false);
  const typingReqIdRef = useRef<number>(0);
  const typingTimerRef = useRef<number | null>(null);
  const hasSentRef = useRef(false);
  // localStorage에서 즉시 읽어서 초기 상태 설정 (깜빡임 방지)
  const [provider, setProvider] = useState<Provider>(() => {
    if (typeof window === "undefined") return "anthropic";
    return getSavedProvider();
  });
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [sceneImageModalUrl, setSceneImageModalUrl] = useState<string | null>(null);
  const [sceneImageQuota, setSceneImageQuota] = useState<{ remaining: number; dailyLimit: number } | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(64);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const lastKeyboardHeightRef = useRef(0);
  const forceScrollRef = useRef(false);
  const isInputFocusedRef = useRef(false);
  
  // 프로필 이미지 미리 로드 (캐시에 저장)
  useEffect(() => {
    if (characterAvatarUrl && typeof window !== "undefined") {
      const img = new window.Image();
      img.src = characterAvatarUrl;
    }
  }, [characterAvatarUrl]);

  // 장면 이미지 모달: Escape로 닫기
  useEffect(() => {
    if (!sceneImageModalUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSceneImageModalUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sceneImageModalUrl]);

  // 장면 이미지 쿼터 초기 조회 (characterAvatarUrl 있을 때)
  useEffect(() => {
    if (!characterAvatarUrl) return;
    const pid = pananaIdRef.current || getPananaId();
    if (!pid) return;
    fetch(`/api/scene-image?pananaId=${encodeURIComponent(pid)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && typeof d?.remaining === "number" && typeof d?.dailyLimit === "number") {
          setSceneImageQuota({ remaining: d.remaining, dailyLimit: d.dailyLimit });
        }
      })
      .catch(() => {});
  }, [characterAvatarUrl, characterSlug]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const status = await fetchAdultStatus();
      if (!alive) return;
      setAdultVerified(Boolean(status?.adultVerified));
      setAdultLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 모바일 키보드 높이 감지 및 메시지 입력창 위치 조정
  useEffect(() => {
    if (typeof window === "undefined") return;

    let initialHeight = window.innerHeight;
    let focusRafId: number | null = null;

    const calcKeyboardHeight = () => {
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        const viewportBottom = viewport.offsetTop + viewport.height;
        const keyboardHeight = window.innerHeight - viewportBottom;
        return keyboardHeight > 20 ? keyboardHeight : 0;
      }
      const heightDiff = initialHeight - window.innerHeight;
      return heightDiff > 20 ? heightDiff : 0;
    };

    const updateKeyboardHeight = () => {
      const next = calcKeyboardHeight();
      if (Math.abs(next - lastKeyboardHeightRef.current) < 2) return;
      lastKeyboardHeightRef.current = next;
      setKeyboardHeight(next);
    };

    const handleFocus = () => {
      isInputFocusedRef.current = true;
      if (focusRafId != null) {
        window.cancelAnimationFrame(focusRafId);
        focusRafId = null;
      }
      const start = performance.now();
      const tick = () => {
        updateKeyboardHeight();
        if (performance.now() - start < 400) {
          focusRafId = window.requestAnimationFrame(tick);
        } else {
          focusRafId = null;
        }
      };
      focusRafId = window.requestAnimationFrame(tick);
      updateKeyboardHeight();
      if (isAtBottomRef.current) {
        endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      }
    };

    const handleBlur = () => {
      isInputFocusedRef.current = false;
      if (focusRafId != null) {
        window.cancelAnimationFrame(focusRafId);
        focusRafId = null;
      }
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
      updateKeyboardHeight();
    } else {
      window.addEventListener("resize", updateKeyboardHeight, { passive: true });
    }

    const input = composerRef.current?.querySelector("input");
    if (input) {
      input.addEventListener("focus", handleFocus, { passive: true });
      input.addEventListener("blur", handleBlur, { passive: true });
    }

    return () => {
      if (window.visualViewport) {
        if (onViewportChange) {
          window.visualViewport.removeEventListener("resize", onViewportChange);
          window.visualViewport.removeEventListener("scroll", onViewportChange);
        }
      } else {
        window.removeEventListener("resize", updateKeyboardHeight);
      }
      if (input) {
        input.removeEventListener("focus", handleFocus);
        input.removeEventListener("blur", handleBlur);
      }
      if (focusRafId != null) {
        window.cancelAnimationFrame(focusRafId);
      }
    };
  }, []);

  // composer 높이 측정 (메시지 영역 패딩 보정)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as Window;
    const el = composerRef.current;
    if (!el) return;

    const update = () => {
      const next = el.getBoundingClientRect().height;
      setComposerHeight(Math.max(64, next));
    };
    update();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    } else {
      win.addEventListener("resize", update);
    }

    return () => {
      if (ro) ro.disconnect();
      else win.removeEventListener("resize", update);
    };
  }, []);
  

  useEffect(() => {
    let rafId = 0;
    const run = () => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      forceScrollRef.current = false;
    };
    rafId = window.requestAnimationFrame(run);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [messages.length, showTyping]);

  const resetTyping = () => {
    typingReqIdRef.current = 0;
    if (typingTimerRef.current != null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setShowTyping(false);
  };

  const getPananaId = () => {
    const idt = ensurePananaIdentity();
    const pid = String(idt.id || "").trim();
    if (pid) pananaIdRef.current = pid;
    return pid;
  };

  const persistToDb = async (pid: string, msgs: Msg[], opts?: { keepalive?: boolean }) => {
    const unsent = msgs.filter((m) => !savedMsgIdsRef.current.has(m.id)).slice(-40);
    const withSceneImage = msgs.filter((m) => m.from === "bot" && m.sceneImageUrl);
    const toPersist = [
      ...unsent,
      ...withSceneImage.filter((m) => savedMsgIdsRef.current.has(m.id)),
    ];
    const unique = Array.from(new Map(toPersist.map((m) => [m.id, m])).values());
    if (!unique.length) return;
    try {
      const res = await fetch("/api/me/chat-messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pananaId: pid,
          characterSlug,
          messages: unique.map((m) => ({
            id: m.id,
            from: m.from,
            text: m.text,
            at: Date.now(),
            sceneImageUrl: m.sceneImageUrl,
          })),
        }),
        // pagehide/unload 시에도 가능한 한 전송되게
        keepalive: Boolean(opts?.keepalive),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return;
      for (const m of unique) savedMsgIdsRef.current.add(m.id);
      lastPersistedAtRef.current = Date.now();
    } catch {
      // ignore
    }
  };

  // 프로필과 런타임을 병렬로 로드
  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, loaded] = await Promise.all([
        fetchMyUserProfile().catch(() => null),
        loadRuntime(characterSlug).catch(() => null),
      ]);
      if (!alive) return;
      const nick = String(p?.nickname || "").trim();
      if (nick) setUserName(nick);
      if (loaded) setRt(loaded);
    })();
    return () => {
      alive = false;
    };
  }, [characterSlug]);

  useEffect(() => {
    let alive = true;
    
    // 1) 로컬 스토리지에서 즉시 메시지 로드 (깜빡임 방지)
    const pidCandidate = getPananaId();
    const localMessages = loadChatHistory({ pananaId: pidCandidate, characterSlug });
    if (localMessages.length > 0) {
      const rows = localMessages.map((m) => ({
        id: m.id,
        from: m.from as any,
        text: m.text,
        sceneImageUrl: m.sceneImageUrl,
      }));
      savedMsgIdsRef.current = new Set(rows.map((m) => m.id));
      setMessages(rows);
      setHistoryLoading(false);
    } else {
      setHistoryLoading(true);
    }

    // 2) 서버에서 pananaId 확정 및 DB 메시지 로드 (백그라운드)
    (async () => {
      let pid = pidCandidate;
      try {
        const res = await fetch("/api/me/identity", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pananaId: pidCandidate }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok && data?.id) {
          pid = String(data.id || "").trim();
          if (pid) {
            setPananaId(pid);
            pananaIdRef.current = pid;
          }
        }
      } catch {
        // ignore
      }

      // DB에서 메시지 로드 (로컬과 다를 수 있으므로 업데이트)
      try {
        const res = await fetch(
          `/api/me/chat-messages?pananaId=${encodeURIComponent(pid)}&characterSlug=${encodeURIComponent(characterSlug)}&limit=120`
        );
        const data = await res.json().catch(() => null);
        if (!alive) return;
        
        if (res.ok && data?.ok && Array.isArray(data.messages)) {
          const rows = data.messages
            .map((m: any) => ({
              id: String(m?.id || ""),
              from: (m?.from === "bot" || m?.from === "user" || m?.from === "system" ? m.from : "system") as Msg["from"],
              text: String(m?.text || ""),
              sceneImageUrl: m?.sceneImageUrl ? String(m.sceneImageUrl).trim() : undefined,
            }))
            .filter((m: any) => m.id && m.text);
          if (rows.length) {
            savedMsgIdsRef.current = new Set(rows.map((m: any) => m.id));
            setMessages(rows);
          }
        } else if (!warnedDbRef.current) {
          const errText = String(data?.error || "").trim();
          if (errText) {
            warnedDbRef.current = true;
            setMessages((prev) => [
              ...prev,
              {
                id: `s-${Date.now()}-dbwarn`,
                from: "system",
                text: `대화 기록(DB)을 불러오지 못했어요. (${errText})`,
              },
            ]);
          }
        }
      } catch {
        // ignore
      }

      if (alive) {
        setHistoryLoading(false);
        if (characterAvatarUrl && pid) {
          fetch(`/api/scene-image?pananaId=${encodeURIComponent(pid)}`)
            .then((r) => r.json())
            .then((d) => {
              if (!alive) return;
              if (d?.ok && typeof d?.remaining === "number" && typeof d?.dailyLimit === "number") {
                setSceneImageQuota({ remaining: d.remaining, dailyLimit: d.dailyLimit });
              }
            })
            .catch(() => {});
        }
      }
    })();
    
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterSlug]);

  useEffect(() => {
    // 메시지 변경 시 히스토리 저장(로컬 백업 + DB 동기화)
    const pid = pananaIdRef.current || getPananaId();
    if (!pid) return;
    // 너무 잦은 저장 방지(짧은 debounce)
    const t = window.setTimeout(() => {
      saveChatHistory({
        pananaId: pid,
        characterSlug,
        messages: messages.map((m) => ({
          id: m.id,
          from: m.from,
          text: m.text,
          at: Date.now(),
          sceneImageUrl: m.sceneImageUrl,
        })),
      });

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      persistToDb(pid, messages);
    }, 80);
    return () => window.clearTimeout(t);
  }, [characterSlug, messages]);

  useEffect(() => {
    // 뒤로가기/탭 종료 등에서 DB 저장 유실 방지
    const onPageHide = () => {
      const pid = pananaIdRef.current;
      if (!pid) return;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      persistToDb(pid, messages, { keepalive: true });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [messages]);

  // "MY" 리스트용: 대화 진입만 해도 목록에 기록
  useEffect(() => {
    recordMyChat({ characterSlug, characterName, avatarUrl: characterAvatarUrl });
  }, [characterAvatarUrl, characterName, characterSlug]);

  const send = async () => {
    const text = value.trim();
    if (!text) return;

    setErr(null);
    forceScrollRef.current = true;
    hasSentRef.current = true;
    isAtBottomRef.current = true;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, from: "user", text }]);
    setValue("");

    // 알파 테스트: 프론트에서 선택한 provider로 즉시 전환
    setSending(true);
    // typing indicator flicker 방지:
    // - 아주 빠른 응답에서는 아예 표시하지 않음(지연 표시)
    // - 요청 ID 기반으로 타이머 무효화(응답 도착 직후 1프레임 깜빡임 방지)
    resetTyping();
    const reqId = Date.now();
    typingReqIdRef.current = reqId;
    typingTimerRef.current = window.setTimeout(() => {
      if (typingReqIdRef.current === reqId) {
        setShowTyping(true);
      }
    }, 650);
    try {
      const idt = ensurePananaIdentity();
      const identityNick = String(idt.nickname || "").trim();
      const resolvedUserName = String(userName || identityNick || idt.handle || "너").trim();
      const runtimeVariables = {
        ...(rt.variables || {}),
        // 템플릿 치환용: 서버에서 buildTemplateVars()가 call_sign까지 채울 수 있게 user_name을 항상 보낸다.
        ...(resolvedUserName ? { user_name: resolvedUserName, call_sign: resolvedUserName } : {}),
        // 기타 유저 식별자도 변수로 제공(콘텐츠에서 {{user_handle}} 등을 쓸 수 있게)
        ...(idt.handle ? { user_handle: String(idt.handle), panana_handle: String(idt.handle) } : {}),
        ...(idt.id ? { panana_id: String(idt.id) } : {}),
      };
      const sceneIdFromRuntime = String((runtimeVariables as any).scene_id || (runtimeVariables as any).sceneId || "").trim();
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          characterSlug,
          sceneId: sceneIdFromRuntime || undefined,
          concise: true,
          // 홈 스파이시 토글(ON)일 때만 성인 대화 허용을 서버에 요청한다.
          // 실제 허용 여부는 서버에서 캐릭터 safety_supported를 보고 최종 결정한다.
          allowUnsafe: (() => {
            try {
                return localStorage.getItem("panana_safety_on") === "1" && adultVerified;
            } catch {
              return false;
            }
          })(),
          runtime: {
            variables: runtimeVariables,
            chat: {
              participants: rt.participants,
              lastActiveAt: rt.lastActiveAt || undefined,
              firedAt: rt.firedAt,
            },
          },
          messages: [
            { role: "system", content: `${characterName} 캐릭터로 자연스럽게 대화해.` },
            ...messages
              .slice(-12)
              .filter((m) => m.from !== "system")
              .map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
            { role: "user", content: text },
          ],
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `LLM error (${res.status})`);
      }

      const nextLabels =
        data?.runtime?.varLabels && typeof data.runtime.varLabels === "object" ? (data.runtime.varLabels as Record<string, string>) : null;
      if (nextLabels) setVarLabels(nextLabels);

      const events: ChatRuntimeEvent[] = Array.isArray(data?.events) ? data.events : [];
      if (events.length) {
        const sysMsgs: Msg[] = [];
        for (const e of events) {
          if (e.type === "system_message") sysMsgs.push({ id: `s-${Date.now()}-${sysMsgs.length}`, from: "system", text: String(e.text || "") });
          else if (e.type === "join") sysMsgs.push({ id: `s-${Date.now()}-${sysMsgs.length}`, from: "system", text: `${String(e.name || "")}이(가) 합류했습니다.` });
          else if (e.type === "leave") sysMsgs.push({ id: `s-${Date.now()}-${sysMsgs.length}`, from: "system", text: `${String(e.name || "")}이(가) 떠났습니다.` });
          else if (e.type === "var_delta") {
            const label = varLabelKo((e as any).var, nextLabels || varLabels);
            const op = (e as any).op === "-" ? "-" : "+";
            const value = Number((e as any).value) || 0;
            // 매핑 없는 변수키는 UI에 노출하지 않음(콘텐츠별 영어키 노출 방지)
            if (label && value) sysMsgs.push({ id: `s-${Date.now()}-${sysMsgs.length}`, from: "system", text: `${label} ${op}${value}` });
          }
          else if (e.type === "unlock_suggest") sysMsgs.push({ id: `s-${Date.now()}-${sysMsgs.length}`, from: "system", text: `해금 제안: ${String(e.text || "")}` });
          else if (e.type === "reset_offer") sysMsgs.push({ id: `s-${Date.now()}-${sysMsgs.length}`, from: "system", text: `되돌리기: ${String(e.text || "")}` });
          else if (e.type === "premium_offer") sysMsgs.push({ id: `s-${Date.now()}-${sysMsgs.length}`, from: "system", text: `프리미엄: ${String(e.text || "")}` });
          else if (e.type === "ep_unlock") sysMsgs.push({ id: `s-${Date.now()}-${sysMsgs.length}`, from: "system", text: `EP 해금: ${String(e.text || "")}` });
        }
        if (sysMsgs.length) setMessages((prev) => [...prev, ...sysMsgs]);
      }

      const reply = String(data.text || "").trim() || "…";
      resetTyping();
      const botId = `b-${Date.now()}`;
      setMessages((prev) => [...prev, { id: botId, from: "bot", text: reply }]);

      const next: ChatRuntimeState | null =
        data?.runtime?.chat
          ? {
              variables: (data?.runtime?.variables as any) || runtimeVariables,
              participants: Array.isArray(data.runtime.chat.participants) ? data.runtime.chat.participants : [],
              lastActiveAt: data.runtime.chat.lastActiveAt ? String(data.runtime.chat.lastActiveAt) : null,
              firedAt: (data.runtime.chat.firedAt as any) || {},
            }
          : null;
      if (next) {
        setRt(next);
        await saveRuntime(characterSlug, next);
      }
    } catch (e: any) {
      setErr(e?.message || "대화에 실패했어요. (LLM 키/모델/공개 뷰/RLS 설정을 확인해주세요)");
    } finally {
      resetTyping();
      setSending(false);
    }
  };

  const needsAdultGate = Boolean(safetySupported) && !adultVerified && !adultLoading;
  if (needsAdultGate) {
    return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] px-5 pb-24 pt-10 text-white">
        <div className="mx-auto w-full max-w-[520px]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <div className="text-[16px] font-extrabold text-white/90">성인 인증이 필요해요</div>
            <div className="mt-2 text-[12px] font-semibold text-white/55">
              스파이시 캐릭터는 성인 인증 후에 이용할 수 있습니다.
            </div>
            <button
              type="button"
              onClick={() => router.push(`/adult/verify?return=/c/${characterSlug}/chat`)}
              className="mt-5 w-full rounded-2xl bg-panana-pink px-5 py-4 text-[14px] font-extrabold text-white"
            >
              성인 인증하러 가기
            </button>
            <button
              type="button"
              onClick={() => router.push(backHref)}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-[13px] font-semibold text-white/70"
            >
              돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white flex flex-col">
      <style>{`@keyframes pananaDot{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(-4px);opacity:1}}`}</style>
      <>
      <header className="mx-auto w-full max-w-[420px] shrink-0 px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link 
            href={backHref} 
            aria-label="뒤로가기" 
            className="absolute left-0 p-2"
            prefetch={true}
          >
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
            {characterName}
          </div>
        </div>

        {/* alpha LLM selector */}
        <div className="mt-2 flex items-center justify-center gap-2">
          {PROVIDERS.map((p) => {
            const active = p.key === provider;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setProvider(p.key);
                  saveProvider(p.key);
                }}
                className={`rounded-full px-3 py-1 text-[11px] font-extrabold ring-1 transition ${
                  active
                    ? "bg-[#ff4da7]/20 text-[#ff8fc3] ring-[#ff4da7]/40"
                    : "bg-white/5 text-white/45 ring-white/10 hover:bg-white/10"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="mt-1 text-center text-[11px] font-semibold text-white/35">
          알파 테스트: 모델을 바꿔가며 대화 품질을 비교할 수 있어요.
        </div>
      </header>

      {/* 메시지 영역만 스크롤(카톡 스타일). 입력창과 겹치지 않음 */}
      <main
        ref={scrollRef}
        className="chat-scrollbar mx-auto w-full max-w-[420px] flex-1 min-h-0 overflow-y-auto px-5 pb-4 pt-4"
        style={{
          paddingBottom: `${Math.max(0, keyboardHeight) + Math.max(0, composerHeight) + 12}px`,
          scrollPaddingBottom: `${Math.max(0, keyboardHeight) + Math.max(0, composerHeight) + 12}px`,
        }}
        onScroll={() => {
          const el = scrollRef.current;
          if (!el) return;
          const threshold = 80;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
          isAtBottomRef.current = atBottom;
        }}
      >
        {err ? <div className="mb-3 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
        <div className="space-y-3">
          {messages.map((m, idx) => {
            const prevUserMsg =
              m.from === "bot"
                ? [...messages].slice(0, idx)
                    .reverse()
                    .find((x) => x.from === "user")?.text || ""
                : undefined;
            const showGenBtn =
              m.from === "bot" &&
              !!characterAvatarUrl &&
              !m.sceneImageLoading &&
              !m.sceneImageError;
            const handleGenerate = showGenBtn
              ? (userMsg: string, botMsg: string) => {
                  setMessages((prev) =>
                    prev.map((x) =>
                      x.id === m.id ? { ...x, sceneImageLoading: true } : x
                    )
                  );
                  const pid = pananaIdRef.current || getPananaId();
                  if (!pid) return;
                  const upToCurrent = messages.slice(0, idx + 1);
                  const recentContext = upToCurrent
                    .filter((x) => x.from === "user" || x.from === "bot")
                    .slice(-8)
                    .map((x) => ({
                      role: x.from === "user" ? ("user" as const) : ("assistant" as const),
                      content: x.text || "",
                    }));
                  fetch("/api/scene-image", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                      pananaId: pid,
                      characterSlug,
                      userMessage: userMsg,
                      assistantMessage: botMsg,
                      recentContext,
                    }),
                  })
                    .then(async (r) => {
                      const d = await r.json().catch(() => ({}));
                      if (!r.ok || !d?.ok) {
                        throw new Error(String(d?.error || `서버 오류 (${r.status})`));
                      }
                      return d;
                    })
                    .then((d) => {
                      setMessages((prev) =>
                        prev.map((x) =>
                          x.id === m.id
                            ? { ...x, sceneImageUrl: d.url, sceneImageLoading: false, sceneImageError: undefined }
                            : x
                        )
                      );
                      if (typeof d?.quotaRemaining === "number" && typeof d?.dailyLimit === "number") {
                        setSceneImageQuota({ remaining: d.quotaRemaining, dailyLimit: d.dailyLimit });
                      }
                    })
                    .catch((e) => {
                      setMessages((prev) =>
                        prev.map((x) =>
                          x.id === m.id
                            ? {
                                ...x,
                                sceneImageLoading: false,
                                sceneImageError: e?.message || "이미지 생성에 실패했어요.",
                              }
                            : x
                        )
                      );
                    });
                }
              : undefined;
            return (
              <Bubble
                key={m.id}
                from={m.from}
                text={m.text}
                avatarUrl={m.from === "bot" ? characterAvatarUrl : undefined}
                onAvatarClick={
                  m.from === "bot" && characterAvatarUrl
                    ? () => setAvatarModalOpen(true)
                    : undefined
                }
                sceneImageUrl={m.from === "bot" ? m.sceneImageUrl : undefined}
                sceneImageLoading={
                  m.from === "bot" ? m.sceneImageLoading : undefined
                }
                sceneImageError={m.from === "bot" ? m.sceneImageError : undefined}
                onGenerateImage={handleGenerate}
                onSceneImageClick={
                  m.from === "bot" && m.sceneImageUrl
                    ? () => setSceneImageModalUrl(m.sceneImageUrl!)
                    : undefined
                }
                sceneImageQuota={m.from === "bot" && characterAvatarUrl ? sceneImageQuota : undefined}
                prevUserMsg={prevUserMsg}
              />
            );
          })}
          {showTyping ? (
            <TypingDots 
              avatarUrl={characterAvatarUrl} 
              onAvatarClick={characterAvatarUrl ? () => setAvatarModalOpen(true) : undefined}
            />
          ) : null}
          <div
            ref={endRef}
            style={{
              scrollMarginBottom: `${Math.max(0, keyboardHeight) + Math.max(0, composerHeight) + 12}px`,
            }}
          />
        </div>
      </main>

      {/* composer */}
      <div
        ref={composerRef}
        className="fixed left-0 right-0 bottom-0 z-40 border-t border-white/10 bg-[#0B0C10]/90 backdrop-blur"
        style={{ 
          transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : 'translateY(0)',
          paddingBottom: keyboardHeight > 0 ? '8px' : 'max(env(safe-area-inset-bottom), 16px)'
        }}
      >
        <div className="mx-auto w-full max-w-[420px] px-5 py-2.5">
          <div className="relative w-full rounded-full border border-panana-pink/35 bg-white/[0.04] py-2 pl-3.5 pr-10">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const composing = (e.nativeEvent as any)?.isComposing;
                if (composing) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              className="w-full bg-transparent text-base font-semibold text-white/70 outline-none placeholder:text-white/30"
              placeholder="메시지를 입력하세요"
              style={{ fontSize: "16px" }}
            />
            <button
              type="button"
              aria-label="전송"
              onClick={send}
              disabled={!value.trim() || sending}
              className="absolute right-[1px] top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/10 ring-1 ring-white/10"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 12h12" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" />
                <path
                  d="M13 5l7 7-7 7"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
      </>

      {/* 장면 이미지 크게 보기 모달 */}
      {sceneImageModalUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSceneImageModalUrl(null)}
          aria-label="닫기"
        >
          <div
            className="relative mx-4 w-full max-w-[480px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-10 right-0 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(sceneImageModalUrl);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `panana-scene-${Date.now()}.webp`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    window.open(sceneImageModalUrl, "_blank");
                  }
                }}
                className="text-white/80 hover:text-white"
                aria-label="다운로드"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSceneImageModalUrl(null)}
                className="text-white/80 hover:text-white"
                aria-label="닫기"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="relative w-full overflow-hidden rounded-2xl bg-black/40 ring-2 ring-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sceneImageModalUrl}
                alt="장면 이미지 크게 보기"
                className="h-auto w-full object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* 프로필 이미지 크게 보기 모달 */}
      {avatarModalOpen && characterAvatarUrl ? (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setAvatarModalOpen(false)}
        >
          <div 
            className="relative mx-4 w-full max-w-[400px]"
            onClick={(e) => e.stopPropagation()}
          >
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
                src={characterAvatarUrl}
                alt={`${characterName} 프로필 이미지`}
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

