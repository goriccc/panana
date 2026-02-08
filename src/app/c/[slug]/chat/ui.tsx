"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMyUserProfile } from "@/lib/pananaApp/userProfiles";
import { loadRuntime, saveRuntime } from "@/lib/pananaApp/chatRuntime";
import { recordMyChat } from "@/lib/pananaApp/myChats";
import {
  loadChatHistory,
  saveChatHistory,
  getThreadList,
  addThread,
  setThreadUpdated,
  updateThreadTitle,
  isDefaultThread,
  type ChatThread,
} from "@/lib/pananaApp/chatHistory";
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

/** 제3자 개입 시스템 메시지: [시스템] system_message:"..." 형태면 따옴표 안 내용만 반환 */
function getSystemMessageDisplayText(raw: string): string {
  const s = String(raw || "").trim();
  const match = /\[시스템\]\s*system_message\s*:\s*"([^"]*)"/.exec(s);
  if (match) return match[1].trim();
  const idx = s.indexOf('system_message:"');
  if (idx !== -1) {
    const start = idx + 'system_message:"'.length;
    const end = s.indexOf('"', start);
    if (end !== -1) return s.slice(start, end).trim();
  }
  return s;
}

/** 봇/시스템 메시지용: ( ) 지문은 문장 내 위치와 관계없이 이탤릭·저투명도 */
function renderChatText(text: string) {
  const lines = String(text || "").split("\n");
  return (
    <div className="whitespace-pre-wrap">
      {lines.map((line, idx) => {
        const raw = String(line);
        const trimmed = raw.trim();
        if (!trimmed) return <div key={idx}>&nbsp;</div>;

        const parts: { script: boolean; text: string }[] = [];
        const re = /(\([^)]*\))|([^(]+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(raw)) !== null) {
          if (m[1]) parts.push({ script: true, text: m[1] });
          else if (m[2]) parts.push({ script: false, text: m[2] });
        }

        return (
          <div key={idx}>
            {parts.map((p, i) =>
              p.script ? (
                <span key={i} className="text-white/45 italic">
                  {p.text}
                </span>
              ) : (
                <span key={i} className="text-white/80">
                  {p.text}
                </span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 유저 말풍선 전용: ( ) 지문은 문장 내 위치와 관계없이 이탤릭·저투명도 */
function renderUserChatText(text: string) {
  const raw = String(text || "").trim();
  if (!raw) return <div>&nbsp;</div>;

  // ( ) 괄호·괄호 내부·그 외 텍스트를 순서대로 분리
  const parts: { script: boolean; text: string }[] = [];
  const re = /(\([^)]*\))|([^(]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[1]) parts.push({ script: true, text: m[1] });
    else if (m[2]) parts.push({ script: false, text: m[2] });
  }

  return (
    <div className="whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.script ? (
          <span key={i} className="italic opacity-60">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
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
          {renderUserChatText(text)}
        </div>
      </div>
    );
  }

  if (from === "system") {
    const displayText = getSystemMessageDisplayText(text);
    return (
      <div className="flex justify-center">
        <div className="max-w-[320px] rounded-2xl bg-white/[0.06] px-4 py-2 text-center text-[12px] font-semibold text-white/70 ring-1 ring-white/10">
          {renderChatText(displayText)}
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
              aria-label="장면 이미지 생성"
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
              {onGenerateImage ? (
                <button
                  type="button"
                  onClick={() => {
                    setImgLoadError(false);
                    onGenerateImage(prevUserMsg ?? "", text);
                  }}
                  className="rounded-full border border-panana-pink/40 bg-panana-pink/15 px-3 py-1.5 text-[11px] font-bold text-panana-pink"
                  aria-label="장면 이미지 다시 생성"
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
          {!imgLoadError && onGenerateImage ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateImage(prevUserMsg ?? "", text);
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
  characterIntroTitle,
  characterIntroLines,
  safetySupported,
}: {
  characterName: string;
  characterSlug: string;
  backHref: string;
  characterAvatarUrl?: string;
  characterIntroTitle?: string;
  characterIntroLines?: string[];
  safetySupported: boolean | null;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [value, setValue] = useState("");
  const [scriptMode, setScriptMode] = useState(false); // 지문 입력 모드: ( ) 괄호 안 커서
  const inputRef = useRef<HTMLInputElement>(null);
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
  const openingReqRef = useRef(false);
  // localStorage에서 즉시 읽어서 초기 상태 설정 (깜빡임 방지)
  const [provider, setProvider] = useState<Provider>(() => {
    if (typeof window === "undefined") return "anthropic";
    return getSavedProvider();
  });
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [sceneImageModalUrl, setSceneImageModalUrl] = useState<string | null>(null);
  const [sceneImageQuota, setSceneImageQuota] = useState<{ remaining: number; dailyLimit: number } | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState("default");
  const [threadList, setThreadListState] = useState<ChatThread[]>([]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("panana_onboarding_chat_v1") === "1";
  });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(64);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const lastKeyboardHeightRef = useRef(0);
  const forceScrollRef = useRef(false);
  const isInputFocusedRef = useRef(false);

  const openingPrompt = useMemo(() => {
    return [
      "대화 시작.",
      "캐릭터 시스템 프롬프트와 로어북을 기반으로 현재 상황을 2~4문장으로 묘사한다.",
      "마지막 문장은 캐릭터가 유저에게 자연스럽게 인사하고 질문한다.",
      "설명 없이 답변만 출력한다.",
    ].join(" ");
  }, []);
  
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

  const requestOpening = async () => {
    if (openingReqRef.current || hasSentRef.current) return;
    openingReqRef.current = true;
    setErr(null);
    setSending(true);
    resetTyping();
    const reqId = Date.now();
    typingReqIdRef.current = reqId;
    typingTimerRef.current = window.setTimeout(() => {
      if (typingReqIdRef.current === reqId) {
        setShowTyping(true);
      }
    }, 450);
    try {
      const idt = ensurePananaIdentity();
      const identityNick = String(idt.nickname || "").trim();
      const resolvedUserName = String(userName || identityNick || idt.handle || "너").trim();
      const runtimeVariables = {
        ...(rt.variables || {}),
        ...(resolvedUserName ? { user_name: resolvedUserName, call_sign: resolvedUserName } : {}),
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
          concise: false,
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
            { role: "user", content: openingPrompt },
          ],
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || `LLM error (${res.status})`);
      if (hasSentRef.current) return;
      const reply = String(data.text || "").trim();
      if (reply) {
        resetTyping();
        setMessages((prev) => [...prev, { id: `b-${Date.now()}-opening`, from: "bot", text: reply }]);
        setHistoryLoading(false);
      }
    } catch (e: any) {
      setErr(e?.message || "오프닝 생성에 실패했어요.");
    } finally {
      resetTyping();
      setSending(false);
    }
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
    const pidCandidate = getPananaId();
    const list = getThreadList({ pananaId: pidCandidate, characterSlug });
    const hasDefault = list.some((t) => t.id === "default");
    setThreadListState(hasDefault ? list : [{ id: "default", title: "현재 대화", updatedAt: Date.now() }, ...list]);

    // 1) 로컬 스토리지에서 현재 스레드 메시지 로드 (깜빡임 방지)
    const localMessages = loadChatHistory({ pananaId: pidCandidate, characterSlug, threadId: currentThreadId });
    if (localMessages.length > 0) {
      const rows = localMessages.map((m) => ({
        id: m.id,
        from: m.from as any,
        text: m.text,
        sceneImageUrl: m.sceneImageUrl,
      }));
      savedMsgIdsRef.current = new Set(rows.map((m) => m.id));
      setMessages(rows);
      if (currentThreadId === "default") {
        const firstUser = rows.find((m) => m.from === "user");
        const title = firstUser?.text?.replace(/\s+/g, " ").trim().slice(0, 20) || "현재 대화";
        setThreadUpdated({ pananaId: pidCandidate, characterSlug, threadId: "default", title });
        setThreadListState(getThreadList({ pananaId: pidCandidate, characterSlug }));
      }
      if (!isDefaultThread(currentThreadId)) {
        setHistoryLoading(false);
      }
    } else if (!isDefaultThread(currentThreadId)) {
      savedMsgIdsRef.current = new Set();
      setMessages([]);
      setHistoryLoading(false);
    } else {
      setHistoryLoading(true);
      void requestOpening();
    }

    // 2) 기본 스레드일 때만 서버에서 pananaId 확정 및 DB 메시지 로드 (백그라운드)
    if (!isDefaultThread(currentThreadId)) {
      setHistoryLoading(false);
      return;
    }
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
              { id: `s-${Date.now()}-dbwarn`, from: "system", text: `대화 기록(DB)을 불러오지 못했어요. (${errText})` },
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
  }, [characterSlug, currentThreadId]);

  useEffect(() => {
    const pid = pananaIdRef.current || getPananaId();
    if (!pid) return;
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
        threadId: currentThreadId,
      });
      const firstUser = messages.find((m) => m.from === "user");
      const titleSnippet = firstUser?.text?.replace(/\s+/g, " ").trim().slice(0, 20) || "대화";
      setThreadUpdated({ pananaId: pid, characterSlug, threadId: currentThreadId, title: titleSnippet });
      setThreadListState(getThreadList({ pananaId: pid, characterSlug }));
      if (isDefaultThread(currentThreadId)) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        persistToDb(pid, messages);
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [characterSlug, currentThreadId, messages]);

  useEffect(() => {
    const onPageHide = () => {
      const pid = pananaIdRef.current;
      if (!pid || !isDefaultThread(currentThreadId)) return;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      persistToDb(pid, messages, { keepalive: true });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [currentThreadId, messages]);

  // "MY" 리스트용: 대화 진입만 해도 목록에 기록
  useEffect(() => {
    recordMyChat({ characterSlug, characterName, avatarUrl: characterAvatarUrl });
  }, [characterAvatarUrl, characterName, characterSlug]);

  // ( ) 괄호 안 내용을 지문으로 추출 (첫 번째 쌍만)
  const parseUserScript = (raw: string): { script: string | null; text: string } => {
    const text = raw.trim();
    const match = text.match(/\(([^)]*)\)/);
    if (match) return { script: match[1].trim() || null, text };
    return { script: null, text };
  };

  // 공통: 메시지 목록(마지막이 유저 메시지)으로 LLM 요청 후 봇 응답 반영. 재시도 시 사용.
  const requestChat = async (messagesIncludingLastUser: Msg[], userScript: string | null) => {
    const history = messagesIncludingLastUser.filter((m) => m.from !== "system");
    const lastUser = history.filter((m) => m.from === "user").pop();
    const text = lastUser?.text?.trim();
    if (!text) return;

    setSending(true);
    resetTyping();
    const reqId = Date.now();
    typingReqIdRef.current = reqId;
    typingTimerRef.current = window.setTimeout(() => {
      if (typingReqIdRef.current === reqId) setShowTyping(true);
    }, 650);

    try {
      const idt = ensurePananaIdentity();
      const identityNick = String(idt.nickname || "").trim();
      const resolvedUserName = String(userName || identityNick || idt.handle || "너").trim();
      const runtimeVariables = {
        ...(rt.variables || {}),
        ...(resolvedUserName ? { user_name: resolvedUserName, call_sign: resolvedUserName } : {}),
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
          userScript: userScript || undefined,
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
            ...history
              .slice(-12)
              .map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
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
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, from: "bot", text: reply }]);

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

  const send = async () => {
    const text = value.trim();
    if (!text) return;

    const { script: userScript } = parseUserScript(text);

    setErr(null);
    forceScrollRef.current = true;
    hasSentRef.current = true;
    isAtBottomRef.current = true;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, from: "user", text }]);
    setValue("");
    setScriptMode(false);

    await requestChat(
      [...messages, { id: `u-${Date.now()}`, from: "user", text }],
      userScript
    );
  };

  const retrySend = () => {
    const lastUser = [...messages].reverse().find((m) => m.from === "user");
    if (!lastUser?.text?.trim()) return;
    setErr(null);
    const { script } = parseUserScript(lastUser.text);
    requestChat(messages, script);
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
              onClick={() =>
                router.push(
                  `/adult/verify?return=${encodeURIComponent(
                    backHref.includes("tab=my") ? `/c/${characterSlug}/chat?from=my` : `/c/${characterSlug}/chat`
                  )}`
                )
              }
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
      <header className="sticky top-0 z-20 mx-auto w-full max-w-[420px] shrink-0 bg-[#07070B]/95 px-5 pb-3 pt-3 backdrop-blur-sm">
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

          <div className="mx-auto flex flex-col items-center">
            <span className="text-[18px] font-semibold tracking-[-0.01em] text-[#ffa9d6]">
              {characterName}
            </span>
            {(() => {
              const userTurns = messages.filter((m) => m.from === "user").length;
              const stage =
                userTurns < 3 ? null
                : userTurns < 10 ? "조금 친해짐"
                : userTurns < 25 ? "친해짐"
                : "매우 친함";
              return stage ? (
                <span className="text-[11px] font-semibold text-white/50" aria-label={`관계: ${stage}`}>
                  {stage}
                </span>
              ) : null;
            })()}
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
                aria-label={`모델: ${p.label}`}
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

      {!onboardingDismissed ? (
        <div className="mx-auto w-full max-w-[420px] shrink-0 px-5 pt-2">
          <div className="flex items-center gap-2 rounded-xl border border-panana-pink/30 bg-panana-pink/10 px-3 py-2.5">
            <div className="flex-1 text-[11px] font-semibold leading-snug text-white/90">
              <span>
                <span className="font-extrabold text-panana-pink">지문</span>: 입력창 왼쪽{" "}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/jimun.png" alt="" width={16} height={16} className="inline h-4 w-4 align-middle opacity-90" aria-hidden />
                {" "}버튼으로 상황·행동 묘사를 넣을 수 있어요.
              </span>
              <span className="mt-1 block">
                <span className="font-extrabold text-panana-pink">장면 이미지</span>: 이미지생성 버튼을 눌러 생성할 수 있어요.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem("panana_onboarding_chat_v1", "1");
                } catch {}
                setOnboardingDismissed(true);
              }}
              className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold text-white/80 hover:bg-white/20"
              aria-label="확인"
            >
              확인
            </button>
          </div>
        </div>
      ) : null}

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
        {err ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-[#ff9aa1]">{err}</span>
            <button
              type="button"
              onClick={retrySend}
              disabled={sending}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white/90 hover:bg-white/20 disabled:opacity-50"
              aria-label="다시 보내기"
            >
              다시 보내기
            </button>
          </div>
        ) : null}
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
          <div className="relative w-full rounded-full border border-panana-pink/35 bg-white/[0.04] py-2 pl-11 pr-11">
            <button
              type="button"
              aria-label={scriptMode ? "지문 입력 끝내기 (일반 대화)" : "지문 입력"}
              onClick={() => {
                const input = inputRef.current;
                if (!input) return;
                const start = input.selectionStart ?? value.length;
                const end = input.selectionEnd ?? value.length;
                const before = value.slice(0, start);
                const after = value.slice(end);
                if (scriptMode) {
                  // 닫는 ) 오른쪽 바깥으로 이동, ) 뒤에 공백 한 칸 넣고 커서는 공백 뒤로
                  const afterCursor = value.slice(end);
                  const closeParen = afterCursor.indexOf(")");
                  if (closeParen >= 0) {
                    const parenPos = end + closeParen + 1;
                    const afterParen = value.slice(parenPos);
                    const needSpace = afterParen.length === 0 || afterParen[0] !== " ";
                    setValue(
                      needSpace
                        ? value.slice(0, parenPos) + " " + value.slice(parenPos)
                        : value
                    );
                    setScriptMode(false);
                    requestAnimationFrame(() => {
                      input.focus();
                      const cursorPos = needSpace ? parenPos + 1 : parenPos;
                      input.setSelectionRange(cursorPos, cursorPos);
                    });
                  } else {
                    setScriptMode(false);
                    requestAnimationFrame(() => {
                      input.focus();
                      input.setSelectionRange(value.length, value.length);
                    });
                  }
                } else {
                  setValue(before + "(" + ")" + after);
                  setScriptMode(true);
                  requestAnimationFrame(() => {
                    input.focus();
                    const pos = before.length + 1;
                    input.setSelectionRange(pos, pos);
                  });
                }
              }}
              className="absolute left-[6px] top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/jimun.png" alt="" width={22} height={22} className="h-[22px] w-[22px] opacity-90" />
            </button>
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                const composing = (e.nativeEvent as KeyboardEvent & { isComposing?: boolean })?.isComposing;
                if (composing) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                  // 모바일에서 rAF는 너무 빨라 키보드가 내려감. setTimeout으로 지연 포커스
                  setTimeout(() => inputRef.current?.focus(), 100);
                }
              }}
              className="w-full bg-transparent text-base font-semibold text-white/70 outline-none placeholder:text-white/30"
              placeholder="메시지를 입력하세요"
              style={{ fontSize: "16px" }}
              aria-label="메시지 입력"
            />
            <button
              type="button"
              aria-label="전송"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                send();
                setTimeout(() => inputRef.current?.focus(), 100);
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

