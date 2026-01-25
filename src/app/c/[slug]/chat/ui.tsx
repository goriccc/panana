"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMyUserProfile } from "@/lib/pananaApp/userProfiles";
import { loadRuntime, saveRuntime } from "@/lib/pananaApp/chatRuntime";
import { recordMyChat } from "@/lib/pananaApp/myChats";
import { loadChatHistory, saveChatHistory } from "@/lib/pananaApp/chatHistory";
import { ensurePananaIdentity, setPananaId } from "@/lib/pananaApp/identity";
import type { ChatRuntimeEvent, ChatRuntimeState } from "@/lib/studio/chatRuntimeEngine";

type Msg = { id: string; from: "bot" | "user" | "system"; text: string };
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

function Bubble({ from, text, avatarUrl }: { from: Msg["from"]; text: string; avatarUrl?: string }) {
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
    <div className="flex w-full justify-start">
      <div className="flex max-w-[320px] items-end gap-2">
        <div className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
          {avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="28px" className="rounded-full object-cover" /> : null}
        </div>
        <div className="rounded-[22px] rounded-bl-[10px] bg-white/[0.06] px-4 py-3 text-[14px] font-semibold leading-[1.45] text-white/80">
          {renderChatText(text)}
        </div>
      </div>
    </div>
  );
}

function TypingDots({ avatarUrl }: { avatarUrl?: string }) {
  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-[320px] items-end gap-2">
        <div className="relative h-7 w-7 flex-none overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
          {avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="28px" className="rounded-full object-cover" /> : null}
        </div>
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
  const [safetyBlocked, setSafetyBlocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [err, setErr] = useState<string | null>(null);
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
  const [provider, setProvider] = useState<Provider>("anthropic");

  useEffect(() => {
    // 스파이시 ON + 캐릭터 미지원이면 강제 차단(직접 URL 접근 방지)
    let on = false;
    try {
      on = localStorage.getItem("panana_safety_on") === "1";
    } catch {}
    if (on && safetySupported === false) {
      setSafetyBlocked(true);
      const t = window.setTimeout(() => router.replace("/home"), 700);
      return () => window.clearTimeout(t);
    }
  }, [router, safetySupported]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const resetTyping = () => {
    typingReqIdRef.current = 0;
    if (typingTimerRef.current != null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setShowTyping(false);
  };

  useEffect(() => {
    setProvider(getSavedProvider());
  }, []);

  const getPananaId = () => {
    const idt = ensurePananaIdentity();
    const pid = String(idt.id || "").trim();
    if (pid) pananaIdRef.current = pid;
    return pid;
  };

  const persistToDb = async (pid: string, msgs: Msg[], opts?: { keepalive?: boolean }) => {
    const unsent = msgs.filter((m) => !savedMsgIdsRef.current.has(m.id)).slice(-40);
    if (!unsent.length) return;
    try {
      const res = await fetch("/api/me/chat-messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pananaId: pid,
          characterSlug,
          messages: unsent.map((m) => ({ id: m.id, from: m.from, text: m.text, at: Date.now() })),
        }),
        // pagehide/unload 시에도 가능한 한 전송되게
        keepalive: Boolean(opts?.keepalive),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) return;
      for (const m of unsent) savedMsgIdsRef.current.add(m.id);
      lastPersistedAtRef.current = Date.now();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (safetyBlocked) return;
    let alive = true;
    (async () => {
      const p = await fetchMyUserProfile();
      if (!alive) return;
      const nick = String(p?.nickname || "").trim();
      if (nick) setUserName(nick);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (safetyBlocked) return;
    let alive = true;
    (async () => {
      const loaded = await loadRuntime(characterSlug);
      if (!alive) return;
      if (loaded) setRt(loaded);
    })();
    return () => {
      alive = false;
    };
  }, [characterSlug]);

  useEffect(() => {
    if (safetyBlocked) return;
    // 이전 대화 불러오기(우선: DB, 실패 시 local fallback)
    (async () => {
      // 0) 서버에서 pananaId 확정(=DB row 존재 보장) 후 그 ID로 저장/로드 통일
      const pidCandidate = getPananaId();
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
        if (res.ok && data?.ok && Array.isArray(data.messages)) {
          const rows = data.messages
            .map((m: any) => ({
              id: String(m?.id || ""),
              from: (m?.from === "bot" || m?.from === "user" || m?.from === "system" ? m.from : "system") as Msg["from"],
              text: String(m?.text || ""),
            }))
            .filter((m: any) => m.id && m.text);
          if (rows.length) {
            savedMsgIdsRef.current = new Set(rows.map((m: any) => m.id));
            setMessages(rows);
            return;
          }
        } else if (!warnedDbRef.current) {
          // DB가 비어있는 케이스를 제외하고(=정상) 에러 힌트를 남긴다.
          // (테이블 미생성/서비스키 미설정/권한 문제 등)
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

      const prev = loadChatHistory({ pananaId: pid, characterSlug });
      if (prev.length) {
        const rows = prev.map((m) => ({ id: m.id, from: m.from as any, text: m.text }));
        savedMsgIdsRef.current = new Set(rows.map((m) => m.id));
        setMessages(rows);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterSlug]);

  useEffect(() => {
    // 메시지 변경 시 히스토리 저장(로컬 백업 + DB 동기화)
    if (safetyBlocked) return;
    const pid = pananaIdRef.current || getPananaId();
    if (!pid) return;
    // 너무 잦은 저장 방지(짧은 debounce)
    const t = window.setTimeout(() => {
      saveChatHistory({
        pananaId: pid,
        characterSlug,
        messages: messages.map((m) => ({ id: m.id, from: m.from, text: m.text, at: Date.now() })),
      });

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      persistToDb(pid, messages);
    }, 80);
    return () => window.clearTimeout(t);
  }, [characterSlug, messages]);

  useEffect(() => {
    // 뒤로가기/탭 종료 등에서 DB 저장 유실 방지
    if (safetyBlocked) return;
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
    if (safetyBlocked) return;
    recordMyChat({ characterSlug, characterName, avatarUrl: characterAvatarUrl });
  }, [characterAvatarUrl, characterName, characterSlug]);

  const send = async () => {
    if (safetyBlocked) return;
    const text = value.trim();
    if (!text) return;

    setErr(null);
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
      if (typingReqIdRef.current === reqId) setShowTyping(true);
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
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          characterSlug,
          concise: true,
          // 홈 스파이시 토글(ON)일 때만 성인 대화 허용을 서버에 요청한다.
          // 실제 허용 여부는 서버에서 캐릭터 safety_supported를 보고 최종 결정한다.
          allowUnsafe: (() => {
            try {
              return localStorage.getItem("panana_safety_on") === "1";
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

  return (
    <div className="h-dvh overflow-hidden bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white flex flex-col">
      <style>{`@keyframes pananaDot{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(-4px);opacity:1}}`}</style>
      {safetyBlocked ? (
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="w-full rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-6">
            <div className="text-[16px] font-extrabold tracking-[-0.01em] text-white/90">스파이시 지원 캐릭터만 이용할 수 있어요</div>
            <div className="mt-2 text-[13px] font-semibold text-white/55">
              현재 스파이시가 켜져 있어요. 이 캐릭터는 스파이시(성인 전용) 대화를 지원하지 않아서 홈으로 이동할게요.
            </div>
            <button
              type="button"
              onClick={() => router.replace("/home")}
              className="mt-5 w-full rounded-2xl bg-[#ff4da7] px-4 py-3 text-[13px] font-extrabold text-white shadow-[0_10px_30px_rgba(255,77,167,0.28)]"
            >
              홈으로 이동
            </button>
          </div>
        </div>
      ) : null}

      {!safetyBlocked ? (
        <>
      <header className="mx-auto w-full max-w-[420px] shrink-0 px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link href={backHref} aria-label="뒤로가기" className="absolute left-0 p-2">
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
      <main className="chat-scrollbar mx-auto w-full max-w-[420px] flex-1 min-h-0 overflow-y-auto px-5 pb-4 pt-4">
        {err ? <div className="mb-3 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
        <div className="space-y-3">
          {messages.map((m) => (
            <Bubble key={m.id} from={m.from} text={m.text} avatarUrl={m.from === "bot" ? characterAvatarUrl : undefined} />
          ))}
          {showTyping ? <TypingDots avatarUrl={characterAvatarUrl} /> : null}
          <div ref={endRef} />
        </div>
      </main>

      {/* composer */}
      <div className="shrink-0 border-t border-white/10 bg-[#0B0C10]/90 pb-[max(env(safe-area-inset-bottom),16px)] backdrop-blur">
        <div className="mx-auto w-full max-w-[420px] px-5 py-3">
          <div className="flex items-center gap-3 rounded-full border border-panana-pink/35 bg-white/[0.04] px-4 py-3">
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
              className="flex-1 bg-transparent text-[14px] font-semibold text-white/70 outline-none placeholder:text-white/30"
              placeholder="메시지를 입력하세요"
            />
            <button
              type="button"
              aria-label="전송"
              onClick={send}
              disabled={!value.trim() || sending}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
      ) : null}
    </div>
  );
}

