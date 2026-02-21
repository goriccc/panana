"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSession } from "next-auth/react";
import { VoiceSessionClient } from "./_components/VoiceSessionClient";

type Msg = {
  id: string;
  from: "bot" | "user" | "system";
  text: string;
  sceneImageUrl?: string;
  sceneImageLoading?: boolean;
  sceneImageError?: string;
  /** 마지막 활동 시각(epoch ms). 오랜만 복귀 시 안부 오프닝 판단용 */
  at?: number;
};

/** 음성 통화에서 생성된 메시지 여부(문자 채팅만 기록하기 위해 제외용) */
function isVoiceMessage(m: Msg): boolean {
  return m.id.startsWith("u-voice-") || m.id.startsWith("b-voice-");
}
/** contenteditable div에서 커서 위치(문자 오프셋) 반환 */
function getCaretOffset(div: HTMLDivElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0).cloneRange();
  try {
    range.selectNodeContents(div);
    range.setEnd(sel.anchorNode!, sel.anchorOffset);
    return range.toString().length;
  } catch {
    return 0;
  }
}

/** contenteditable div에서 커서를 지정한 문자 오프셋으로 이동 */
function setCaretOffset(div: HTMLDivElement, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const text = div.innerText ?? "";
  const pos = Math.max(0, Math.min(offset, text.length));
  const range = document.createRange();
  let passed = 0;
  const walk = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? "").length;
      if (passed + len >= pos) {
        range.setStart(node, pos - passed);
        range.collapse(true);
        return true;
      }
      passed += len;
      return false;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      if (walk(node.childNodes[i]!)) return true;
    }
    return false;
  };
  walk(div);
  sel.removeAllRanges();
  sel.addRange(range);
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

/** 봇/시스템 메시지용: ( ) （ ） 괄호 안만 반투명 이탤릭, 괄호 밖은 불투명 흰색 */
function renderChatText(text: string) {
  const lines = String(text || "").split("\n");
  return (
    <div className="whitespace-pre-wrap text-white">
      {lines.map((line, idx) => {
        const raw = String(line);
        const trimmed = raw.trim();
        if (!trimmed) return <div key={idx}>&nbsp;</div>;

        const parts: { script: boolean; text: string }[] = [];
        // 캡처 그룹:
        // m[1] = ( ... ) 지문, m[2] = （ ... ） 지문, m[3] = 괄호 밖 일반 대사
        const re = /(\([^)]*\))|(（[^）]*）)|([^(（]+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(raw)) !== null) {
          if (m[1] || m[2]) parts.push({ script: true, text: m[1] || m[2] });
          else if (m[3]) parts.push({ script: false, text: m[3] });
        }

        return (
          <div key={idx}>
            {parts.map((p, i) =>
              p.script ? (
                <span key={i} className="italic opacity-60">{p.text}</span>
              ) : (
                <span key={i} className="not-italic text-white">{p.text}</span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 유저 말풍선 전용: 불투명 검정색, 이탤릭 없음 */
function renderUserChatText(text: string) {
  const raw = String(text || "").trim();
  if (!raw) return <div>&nbsp;</div>;
  return <div className="whitespace-pre-wrap not-italic">{raw}</div>;
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
      <div className="flex w-full justify-end">
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
    <div className="flex w-full justify-start">
      <div className="flex max-w-[320px] flex-col gap-2">
        <div className="flex items-end gap-2">
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
          <div className="rounded-[22px] rounded-bl-[10px] bg-white/[0.06] px-4 py-3 text-[14px] font-semibold leading-[1.45] text-white">
            {renderChatText(text)}
          </div>
          {sceneImageError ? (
            <div className="text-[11px] font-semibold text-[#ff9aa1]">{sceneImageError}</div>
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
                  className="rounded-full border border-panana-pink2/40 bg-panana-pink2/15 px-3 py-1.5 text-[11px] font-bold text-panana-pink2"
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
  const inputRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [adultVerified, setAdultVerified] = useState(false);
  const [showNeedAdultVerifyBanner, setShowNeedAdultVerifyBanner] = useState(false);
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
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  /** iOS 링톤: 전화 아이콘 탭과 같은 제스처에서 재생하려면 URL을 미리 로드 */
  const [preloadedVoiceRingtoneUrl, setPreloadedVoiceRingtoneUrl] = useState<string | null>(null);
  const [voicePhase, setVoicePhase] = useState<"idle" | "ringing" | "connected">("idle");
  const [currentModelLabel, setCurrentModelLabel] = useState<string | null>(null);
  const [currentVoiceModelLabel, setCurrentVoiceModelLabel] = useState<string | null>(null);
  const { data: session } = useSession();
  const userAvatarUrl = String((session as any)?.profileImageUrl || (session as any)?.user?.image || "").trim() || undefined;
  const composerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const lastKeyboardHeightRef = useRef(0);
  const forceScrollRef = useRef(false);
  const isInputFocusedRef = useRef(false);
  const llmConfigRef = useRef<{
    defaultProvider: string;
    fallbackProvider: string;
    fallbackModel: string;
    settings: Array<{ provider: string; model: string }>;
  } | null>(null);

  const [safetyOn, setSafetyOn] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const v = document.cookie.split("; ").find((r) => r.startsWith("panana_safety_on="));
        setSafetyOn(v ? v.split("=")[1] === "1" : localStorage.getItem("panana_safety_on") === "1");
      } catch {
        setSafetyOn(false);
      }
    };
    read();
    window.addEventListener("panana-safety-change", read as EventListener);
    return () => window.removeEventListener("panana-safety-change", read as EventListener);
  }, []);
  const headerAccent = safetyOn ? "text-panana-pink2" : "text-[#ffa9d6]";
  const composerBorderStyle = safetyOn
    ? { borderColor: "color-mix(in srgb, var(--panana-pink2, #FFA1CC) 50%, transparent)" }
    : undefined;
  const composerBorderClass = safetyOn ? "" : "border-[#ffa9d6]/50";

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
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          ...(model ? { model } : {}),
          characterSlug,
          sceneId: sceneIdFromRuntime || undefined,
          concise: false,
          allowUnsafe,
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
      if (data?.provider != null && data?.model != null && String(data.model).toLowerCase() !== "auto") {
        const p = String(data.provider).toLowerCase();
        const providerLabel = p === "anthropic" ? "Claude" : p === "gemini" ? "Gemini" : p === "deepseek" ? "DeepSeek" : data.provider;
        setCurrentModelLabel(`${providerLabel} · ${String(data.model)}`);
      }
      const reply = String(data.text || "").trim();
      if (reply) {
        resetTyping();
        setMessages((prev) => [...prev, { id: `b-${Date.now()}-opening`, from: "bot", text: reply, at: Date.now() }]);
        setHistoryLoading(false);
      }
    } catch (e: any) {
      setErr(e?.message || "오프닝 생성에 실패했어요.");
    } finally {
      resetTyping();
      setSending(false);
    }
  };

  const RETURNING_OPENER_THROTTLE_MS = 24 * 60 * 60 * 1000;
  const returningOpenerReqRef = useRef(false);

  const requestReturningOpening = useCallback(
    async (pid: string, characterSlug: string, messagesForContext: Msg[], lastMessageAt: number) => {
      if (returningOpenerReqRef.current) return;
      returningOpenerReqRef.current = true;
      const history = messagesForContext
        .filter((m) => m.from !== "system")
        .slice(-40)
        .map((m) => ({ role: m.from === "user" ? "user" as const : "assistant" as const, content: m.text }));
      const hoursAgo = Math.round((Date.now() - lastMessageAt) / (60 * 60 * 1000));
      const daysAgo = hoursAgo >= 24 ? Math.round(hoursAgo / 24) : 0;
      const timeLabel = daysAgo > 0 ? `${daysAgo}일만` : `${hoursAgo}시간만`;
      const returningPrompt = [
        "대화 시작.",
        `유저가 ${timeLabel}에 대화방에 들어왔다.`,
        "[유저 프로필]과 [우리의 지난 서사]와 위 대화를 참고해, 유저가 과거에 언급한 일(면접, 시험, 맞선, 중요한 일정 등)이 지났거나 다가오면 자연스럽게 안부를 물어봐라.",
        "이미 대화에서 유저가 결과를 말한 주제는 다시 묻지 마라.",
        "2~4문장, 캐릭터 대사만 출력해라.",
      ].join(" ");
      try {
        const idt = ensurePananaIdentity();
        const identityNick = String(idt.nickname || "").trim();
        const resolvedUserName = String(userName || identityNick || idt.handle || "너").trim();
        const runtimeVariables = {
          ...(rt.variables || {}),
          ...(resolvedUserName ? { user_name: resolvedUserName, call_sign: resolvedUserName } : {}),
          ...(idt.handle ? { user_handle: String(idt.handle), panana_handle: String(idt.handle) } : {}),
          ...(idt.id ? { panana_id: String(pid) } : {}),
        };
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
        const res = await fetch("/api/llm/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider,
            ...(model ? { model } : {}),
            characterSlug,
            concise: false,
            allowUnsafe,
            runtime: { variables: runtimeVariables, chat: { participants: rt.participants, lastActiveAt: rt.lastActiveAt || undefined, firedAt: rt.firedAt } },
            messages: [
              { role: "system", content: `${characterName} 캐릭터로 자연스럽게 대화해.` },
              ...history.map((m) => ({ role: m.role, content: m.content })),
              { role: "user", content: returningPrompt },
            ],
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) return;
        const reply = String(data.text || "").trim();
        if (reply) {
          setMessages((prev) => [...prev, { id: `b-${Date.now()}-returning`, from: "bot", text: reply, at: Date.now() }]);
          try {
            const key = `panana_returning_opener:${pid}:${characterSlug}`;
            const raw = localStorage.getItem(key);
            const obj = raw ? JSON.parse(raw) : {};
            obj.lastShownAt = Date.now();
            localStorage.setItem(key, JSON.stringify(obj));
          } catch {}
        }
      } catch {
        // 실패 시 무시
      } finally {
        returningOpenerReqRef.current = false;
      }
    },
    [characterName, userName, rt, adultVerified]
  );

  function tryRunReturningOpening(pid: string, characterSlug: string, rows: Msg[], lastAt: number) {
    const now = Date.now();
    if (now - lastAt < RETURNING_OPENER_THROTTLE_MS) return;
    try {
      const key = `panana_returning_opener:${pid}:${characterSlug}`;
      const raw = localStorage.getItem(key);
      const obj = raw ? JSON.parse(raw) : {};
      const lastShownAt = Number(obj?.lastShownAt) || 0;
      if (lastShownAt > 0 && now - lastShownAt < RETURNING_OPENER_THROTTLE_MS) return;
      void requestReturningOpening(pid, characterSlug, rows, lastAt);
    } catch {}
  }

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
            at: m.at ?? Date.now(),
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

  /** iOS 링톤: 채팅 화면 로드 시 링톤 URL 미리 fetch → 전화 아이콘 탭 시 같은 제스처에서 재생 가능 */
  useEffect(() => {
    fetch("/api/voice/config")
      .then((r) => r.json())
      .then((d) => {
        const url = (d?.data as any)?.ringtone_url;
        if (url && typeof url === "string" && url.trim()) setPreloadedVoiceRingtoneUrl(url.trim());
      })
      .catch(() => {});
  }, []);

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
        ...(m.at ? { at: m.at } : {}),
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
      // 일반 오프닝은 DB 로드 후 결정: DB에 과거 대화가 있으면 오랜만 오프닝만, 없으면 일반 오프닝만 (충돌 방지)
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
              ...(m?.at != null ? { at: Number(m.at) } : {}),
            }))
            .filter((m: any) => m.id && m.text);
          if (rows.length) {
            savedMsgIdsRef.current = new Set(rows.map((m: any) => m.id));
            setMessages(rows);
            const lastAt = rows[rows.length - 1]?.at;
            if (typeof lastAt === "number" && lastAt > 0 && alive) {
              tryRunReturningOpening(pid, characterSlug, rows, lastAt);
            }
            if (alive) setHistoryLoading(false);
          } else {
            if (alive) void requestOpening();
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
    const textOnlyMessages = messages.filter((m) => !isVoiceMessage(m));
    const t = window.setTimeout(() => {
      saveChatHistory({
        pananaId: pid,
        characterSlug,
        messages: textOnlyMessages.map((m) => ({
          id: m.id,
          from: m.from,
          text: m.text,
          at: m.at ?? Date.now(),
          sceneImageUrl: m.sceneImageUrl,
        })),
        threadId: currentThreadId,
      });
      const firstUser = textOnlyMessages.find((m) => m.from === "user");
      const titleSnippet = firstUser?.text?.replace(/\s+/g, " ").trim().slice(0, 20) || "대화";
      setThreadUpdated({ pananaId: pid, characterSlug, threadId: currentThreadId, title: titleSnippet });
      setThreadListState(getThreadList({ pananaId: pid, characterSlug }));
      if (isDefaultThread(currentThreadId)) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        persistToDb(pid, textOnlyMessages);
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [characterSlug, currentThreadId, messages]);

  useEffect(() => {
    const onPageHide = () => {
      const pid = pananaIdRef.current;
      if (!pid || !isDefaultThread(currentThreadId)) return;
      const textOnlyMessages = messages.filter((m) => !isVoiceMessage(m));
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      persistToDb(pid, textOnlyMessages, { keepalive: true });
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

  /** 사진/셀카 요청 가능성 있는지 (이 키워드 있을 때만 분류 API 호출) */
  const mightBePhotoRequest = (msg: string): boolean => {
    const s = (msg || "").trim();
    if (!s) return false;
    return /사진|셀카|찍어|보내/.test(s);
  };

  /** 서버와 동일한 패턴: 명확한 "사진/셀카 보내" 요청 (API 실패 시 클라이언트 폴백용) */
  const isClearPhotoRequest = (msg: string): boolean => {
    const s = (msg || "").trim();
    if (!s) return false;
    const explicitRequest =
      /(?:사진|셀카|셀피|selfie|photo|pic)[^.!?\n]{0,24}?(?:찍(?:어|어서)?\s*)?(?:보내(?:줘|주라|주세요|줘요|줄래)?|전송(?:해|해줘|해주세요)?)(?:\s*줘)?|(?:보내(?:줘|주라|주세요|줘요|줄래)?|전송(?:해|해줘|해주세요)?)[^.!?\n]{0,24}?(?:사진|셀카|셀피|selfie|photo|pic)/i;
    const shortNaturalRequest = /^(?:셀카|사진)\s*(?:좀|하나|한\s*장|한장)?\s*(?:만)?\s*$/i;
    return explicitRequest.test(s) || shortNaturalRequest.test(s);
  };

  /** "사진/셀카 찍어서 보내달라" 의미인지 판별 (API + 실패 시 클라이언트 폴백) */
  const classifyPhotoRequest = async (userMessage: string): Promise<boolean> => {
    if (!mightBePhotoRequest(userMessage)) return false;
    if (isClearPhotoRequest(userMessage)) return true;
    try {
      const res = await fetch("/api/classify-photo-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const d = await res.json().catch(() => ({}));
      const apiResult = Boolean(d?.isPhotoRequest);
      return apiResult || isClearPhotoRequest(userMessage);
    } catch {
      return isClearPhotoRequest(userMessage);
    }
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
      const totalUserTurnsInThread = history.filter((m) => m.from === "user").length;
      const runtimeVariables = {
        ...(rt.variables || {}),
        ...(resolvedUserName ? { user_name: resolvedUserName, call_sign: resolvedUserName } : {}),
        ...(idt.handle ? { user_handle: String(idt.handle), panana_handle: String(idt.handle) } : {}),
        ...(idt.id ? { panana_id: String(idt.id) } : {}),
        ...(typeof totalUserTurnsInThread === "number" ? { total_user_turns_in_thread: totalUserTurnsInThread } : {}),
      };
      const sceneIdFromRuntime = String((runtimeVariables as any).scene_id || (runtimeVariables as any).sceneId || "").trim();
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
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          ...(model ? { model } : {}),
          characterSlug,
          sceneId: sceneIdFromRuntime || undefined,
          concise: true,
          userScript: userScript || undefined,
          allowUnsafe,
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
              .slice(-40)
              .map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
          ],
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `LLM error (${res.status})`);
      }
      if (data?.provider != null && data?.model != null && String(data.model).toLowerCase() !== "auto") {
        const p = String(data.provider).toLowerCase();
        const providerLabel = p === "anthropic" ? "Claude" : p === "gemini" ? "Gemini" : p === "deepseek" ? "DeepSeek" : data.provider;
        setCurrentModelLabel(`${providerLabel} · ${String(data.model)}`);
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
      const botId = `b-${Date.now()}`;
      const newBotMsg: Msg = { id: botId, from: "bot", text: reply, at: Date.now() };
      setMessages((prev) => [...prev, newBotMsg]);
      if (data.needAdultVerify) setShowNeedAdultVerifyBanner(true);

      if (characterAvatarUrl) {
        const isPhotoRequest =
          isClearPhotoRequest(text) || (await classifyPhotoRequest(text));
        if (isPhotoRequest) {
          setMessages((prev) =>
            prev.map((x) =>
              x.id === botId ? { ...x, sceneImageLoading: true } : x
            )
          );
          const pid = pananaIdRef.current || getPananaId();
          if (!pid) {
            setMessages((prev) =>
              prev.map((x) =>
                x.id === botId
                  ? { ...x, sceneImageLoading: false, sceneImageError: "이미지를 생성하려면 로그인이 필요해요." }
                  : x
              )
            );
          } else {
            const upToCurrent = [...messagesIncludingLastUser, { ...newBotMsg, text: reply }];
            const recentContext = upToCurrent
              .filter((x) => x.from === "user" || x.from === "bot")
              .slice(-8)
              .map((x) => ({
                role: (x.from === "user" ? "user" : "assistant") as "user" | "assistant",
                content: x.text || "",
              }));
            fetch("/api/scene-image", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                pananaId: pid,
                characterSlug,
                userMessage: text,
                assistantMessage: reply,
                recentContext,
              }),
            })
              .then(async (r) => {
                const d = await r.json().catch(() => ({}));
                if (!r.ok || !d?.ok) throw new Error(String(d?.error || `서버 오류 (${r.status})`));
                return d;
              })
              .then((d) => {
                setMessages((prev) =>
                  prev.map((x) =>
                    x.id === botId
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
                    x.id === botId
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
        }
      }

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
    setShowNeedAdultVerifyBanner(false);
    forceScrollRef.current = true;
    hasSentRef.current = true;
    isAtBottomRef.current = true;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, from: "user", text, at: Date.now() }]);
    setValue("");
    if (inputRef.current) inputRef.current.innerText = "";
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

  // Visual Viewport API: 키보드 시 컨테이너를 보이는 영역에 즉시 맞춤. 지연 없이 적용해 "밀려올라갔다 나오는" 현상 방지. 변경이 2px 이상일 때만 DOM 갱신해 resize 연타 시 움찔 완화.
  useEffect(() => {
    if (needsAdultGate || !chatContainerRef.current) return;
    const el = chatContainerRef.current;
    const vv = window.visualViewport;
    if (!vv) return;

    const THRESHOLD = 2;
    let lastTop = -999;
    let lastLeft = -999;
    let lastWidth = -999;
    let lastHeight = -999;

    const applyViewport = () => {
      if (!el || !vv) return;
      const top = vv.offsetTop;
      const left = vv.offsetLeft;
      const w = vv.width;
      const h = vv.height;
      const changed =
        Math.abs(top - lastTop) >= THRESHOLD ||
        Math.abs(left - lastLeft) >= THRESHOLD ||
        Math.abs(w - lastWidth) >= THRESHOLD ||
        Math.abs(h - lastHeight) >= THRESHOLD;
      if (!changed && lastTop !== -999) return;
      lastTop = top;
      lastLeft = left;
      lastWidth = w;
      lastHeight = h;
      el.style.position = "fixed";
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    };
    const onScrollLock = () => {
      window.scrollTo(0, 0);
    };

    applyViewport();
    vv.addEventListener("resize", applyViewport);
    vv.addEventListener("scroll", applyViewport);
    window.addEventListener("scroll", onScrollLock, { passive: true });

    return () => {
      vv.removeEventListener("resize", applyViewport);
      vv.removeEventListener("scroll", applyViewport);
      window.removeEventListener("scroll", onScrollLock);
      el.style.position = "";
      el.style.top = "";
      el.style.left = "";
      el.style.width = "";
      el.style.height = "";
    };
  }, [needsAdultGate]);

  return (
    <div className="min-h-dvh">
      <div
        ref={chatContainerRef}
        className="fixed inset-0 flex flex-col overflow-hidden bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white"
      >
        <style>{`@keyframes pananaDot{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(-4px);opacity:1}}`}</style>
        <>
      {/* 키보드 올라와도 헤더가 밀리지 않도록 상단 고정(스크롤 영역 밖) */}
      <header className="shrink-0 z-20 bg-[#07070B]/95 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
        <div className="relative flex h-11 items-center mx-auto w-full max-w-[420px] px-5 pb-3 pt-3">
          <Link 
            href={backHref} 
            aria-label="뒤로가기" 
            className={`absolute left-0 p-2 ${headerAccent}`}
            prefetch={true}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-current">
              <path
                d="M15 6l-6 6 6 6"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <div className="mx-auto flex flex-col items-center">
            <span className={`text-[18px] font-semibold tracking-[-0.01em] ${headerAccent}`}>
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
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className="absolute right-0 p-2 text-white/70 hover:text-panana-pink2 transition"
            aria-label="음성 대화"
          >
            <style
              dangerouslySetInnerHTML={{
                __html: `@keyframes voice-ring-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}`,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/call_start.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              style={voiceModalOpen && voicePhase === "ringing" ? { animation: "voice-ring-shake 0.5s ease-in-out infinite" } : undefined}
              aria-hidden
            />
          </button>
        </div>
      </header>

      {!onboardingDismissed ? (
        <div className="mx-auto w-full max-w-[420px] shrink-0 px-5 pt-2">
          <div className="flex items-center gap-2 rounded-xl border border-panana-pink2/30 bg-panana-pink2/10 px-3 py-2.5">
            <div className="flex-1 text-[11px] font-semibold leading-snug text-white/90">
              <span>
                <span className="font-extrabold text-panana-pink2">지문</span>: 입력창 왼쪽{" "}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/jimun.png" alt="" width={16} height={16} className="inline h-4 w-4 align-middle opacity-90" aria-hidden />
                {" "}버튼으로 상황·행동 묘사를 넣을 수 있어요.
              </span>
              <span className="mt-1 block">
                <span className="font-extrabold text-panana-pink2">장면 이미지</span>: 이미지생성 버튼을 눌러 생성할 수 있어요.
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

      {/* 스크롤 영역 = 헤더 바로 밑부터. 말풍선이 잘리지 않게 영역만 사용 */}
      <main
        ref={scrollRef}
        className="chat-scrollbar mx-auto w-full max-w-[420px] min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4 pt-3"
        style={{
          minHeight: 120,
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
          {voiceModalOpen ? (
            <VoiceSessionClient
              characterSlug={characterSlug}
              characterName={characterName}
              callSign={userName}
              onClose={() => {
                setVoiceModalOpen(false);
                setVoicePhase("idle");
                setCurrentVoiceModelLabel(null);
              }}
              onPhaseChange={setVoicePhase}
              onVoiceModelReady={setCurrentVoiceModelLabel}
              onUserTranscript={() => {}}
              onAssistantTranscript={() => {}}
              characterAvatarUrl={characterAvatarUrl}
              userAvatarUrl={userAvatarUrl}
              startOnOpen
              preloadedRingtoneUrl={preloadedVoiceRingtoneUrl}
              recentMessages={messages
                .filter((m): m is Msg & { from: "user" | "bot" } =>
                  (m.from === "user" || m.from === "bot") && !isVoiceMessage(m))
                .slice(-10)
                .map((m) => ({ from: m.from, text: m.text || "" }))}
            />
          ) : null}
          {showNeedAdultVerifyBanner ? (
            <div className="mb-3 rounded-xl border border-panana-pink2/40 bg-white/[0.06] p-3">
              <p className="text-[12px] font-semibold text-white/80">
                성인인증이 필요합니다!
              </p>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/adult/verify?return=${encodeURIComponent(
                      backHref.includes("tab=my") ? `/c/${characterSlug}/chat?from=my` : `/c/${characterSlug}/chat`
                    )}`
                  )
                }
                className="mt-2 w-full rounded-lg bg-panana-pink px-3 py-2 text-[13px] font-bold text-white"
              >
                성인 인증하고 계속하기
              </button>
            </div>
          ) : null}
          <div
            className={`relative w-full rounded-full border bg-white/[0.04] py-2 pl-11 pr-11 ${composerBorderClass} ${voiceModalOpen ? "mt-3" : ""}`}
            style={composerBorderStyle}
          >
            <button
              type="button"
              aria-label={scriptMode ? "지문 입력 끝내기 (일반 대화)" : "지문 입력"}
              onClick={() => {
                const div = inputRef.current;
                if (!div) return;
                const start = getCaretOffset(div);
                const end = start; // 단일 커서
                const before = value.slice(0, start);
                const after = value.slice(end);
                if (scriptMode) {
                  const afterCursor = value.slice(end);
                  const closeParen = afterCursor.indexOf(")");
                  if (closeParen >= 0) {
                    const parenPos = end + closeParen + 1;
                    const afterParen = value.slice(parenPos);
                    const needSpace = afterParen.length === 0 || afterParen[0] !== " ";
                    const newVal = needSpace
                      ? value.slice(0, parenPos) + " " + value.slice(parenPos)
                      : value;
                    setValue(newVal);
                    div.innerText = newVal;
                    setScriptMode(false);
                    requestAnimationFrame(() => {
                      div.focus();
                      setCaretOffset(div, needSpace ? parenPos + 1 : parenPos);
                    });
                  } else {
                    setScriptMode(false);
                    requestAnimationFrame(() => {
                      div.focus();
                      setCaretOffset(div, value.length);
                    });
                  }
                } else {
                  const newVal = before + "(" + ")" + after;
                  setValue(newVal);
                  div.innerText = newVal;
                  setScriptMode(true);
                  requestAnimationFrame(() => {
                    div.focus();
                    setCaretOffset(div, before.length + 1);
                  });
                }
              }}
              className="absolute left-[6px] top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/jimun.png" alt="" width={22} height={22} className="h-[22px] w-[22px] opacity-90" />
            </button>
            <div
              ref={inputRef}
              role="textbox"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="메시지를 입력하세요"
              aria-label="메시지 입력"
              className="min-h-[1.5rem] w-full bg-transparent text-base font-semibold text-white/70 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-white/30"
              style={{ fontSize: "16px" }}
              onInput={() => {
                const el = inputRef.current;
                if (!el) return;
                const text = (el.innerText ?? "").replace(/\n/g, " ");
                setValue(text);
                if ((el.innerText ?? "").includes("\n")) el.innerText = text;
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
                  send();
                  if (inputRef.current) inputRef.current.innerText = "";
                  setValue("");
                  setTimeout(() => inputRef.current?.focus(), 100);
                }
              }}
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
    </div>
  );
}

