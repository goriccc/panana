"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMyUserProfile } from "@/lib/pananaApp/userProfiles";
import { loadRuntime, saveRuntime } from "@/lib/pananaApp/chatRuntime";
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
}: {
  characterName: string;
  characterSlug: string;
  backHref: string;
  characterAvatarUrl?: string;
}) {
  const [sending, setSending] = useState(false);
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [varLabels, setVarLabels] = useState<Record<string, string>>({});
  const [rt, setRt] = useState<ChatRuntimeState>({
    variables: {},
    participants: [],
    lastActiveAt: null,
    firedAt: {},
  });

  const endRef = useRef<HTMLDivElement | null>(null);
  const [provider, setProvider] = useState<Provider>("anthropic");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  useEffect(() => {
    setProvider(getSavedProvider());
  }, []);

  useEffect(() => {
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

  const send = async () => {
    const text = value.trim();
    if (!text) return;

    setErr(null);
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, from: "user", text }]);
    setValue("");

    // 알파 테스트: 프론트에서 선택한 provider로 즉시 전환
    setSending(true);
    try {
      const runtimeVariables = {
        ...(rt.variables || {}),
        ...(userName ? { user_name: userName } : {}),
      };
      const res = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          characterSlug,
          concise: true,
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
      setSending(false);
    }
  };

  return (
    <div className="h-dvh overflow-hidden bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white flex flex-col">
      <style>{`@keyframes pananaDot{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(-4px);opacity:1}}`}</style>
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
          {sending ? <TypingDots avatarUrl={characterAvatarUrl} /> : null}
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
    </div>
  );
}

