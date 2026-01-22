"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { StudioSelect } from "@/app/studio/_components/StudioSelect";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { studioLoadSceneParticipants } from "@/lib/studio/db";
import type { StudioCharacterRow, StudioSceneRow } from "@/lib/studio/db";

type ChatMsg = { role: "user" | "assistant"; content: string };

function renderChatText(content: string) {
  const lines = String(content || "").split("\n");
  return (
    <div className="whitespace-pre-wrap">
      {lines.map((line, idx) => {
        const raw = String(line);
        const trimmed = raw.trim();
        if (!trimmed) {
          return <div key={idx}>&nbsp;</div>;
        }

        // "(지문) 대사" 또는 "(지문)" 패턴 지원
        if (trimmed.startsWith("(") && trimmed.includes(")")) {
          const closeIdx = trimmed.indexOf(")");
          const nar = trimmed.slice(0, closeIdx + 1);
          const rest = trimmed.slice(closeIdx + 1).trim();
          return (
            <div key={idx}>
              <div className="text-white/45 italic">{nar}</div>
              {rest ? <div className="text-inherit">{rest}</div> : null}
            </div>
          );
        }

        return (
          <div key={idx} className="text-inherit">
            {raw}
          </div>
        );
      })}
    </div>
  );
}

function ChatBubble({ role, content }: { role: ChatMsg["role"]; content: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-[13px] font-semibold",
          isUser ? "bg-[#4F7CFF] text-white" : "bg-white/[0.06] text-white/85 ring-1 ring-white/10"
        )}
      >
        {renderChatText(content)}
      </div>
    </div>
  );
}

async function mustAccessToken() {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token || "";
  if (!token) throw new Error("로그인이 필요해요.");
  return token;
}

async function simChat(args: {
  provider: "anthropic" | "gemini" | "deepseek";
  characterId: string;
  sceneId?: string;
  asCharacterId?: string;
  messages: ChatMsg[];
}) {
  const token = await mustAccessToken();
  const sanitized = (args.messages || [])
    .map((m) => ({ role: m.role, content: String(m.content || "").trim() }))
    .filter((m) => m.content.length > 0);
  const res = await fetch("/api/studio/simulator/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...args, messages: sanitized }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || "시뮬레이터 호출에 실패했어요.");
  return String(data.text || "");
}

export function ProjectSimulatorClient({
  projectTitle,
  projectId,
  cast,
  scenes,
}: {
  projectTitle: string;
  projectId: string;
  cast: StudioCharacterRow[];
  scenes: StudioSceneRow[];
}) {
  const [provider, setProvider] = useState<"anthropic" | "gemini" | "deepseek">("gemini");

  // 1:1
  const [targetCharacterId, setTargetCharacterId] = useState<string>(cast[0]?.id || "");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // scene mode
  const [sceneId, setSceneId] = useState<string>(scenes[0]?.id || "");
  const [sceneParticipantIds, setSceneParticipantIds] = useState<string[]>([]);
  const [asCharacterId, setAsCharacterId] = useState<string>("");
  const [sceneMsgs, setSceneMsgs] = useState<ChatMsg[]>([]);
  const [sceneInput, setSceneInput] = useState("");
  const [sceneBusy, setSceneBusy] = useState(false);
  const [sceneErr, setSceneErr] = useState<string | null>(null);

  const listCastOptions = useMemo(() => cast.map((c) => ({ value: c.id, label: `${c.name}${c.role_label ? ` · ${c.role_label}` : ""}` })), [cast]);
  const listSceneOptions = useMemo(
    () => scenes.map((s) => ({ value: s.id, label: `${s.episode_label || ""} · ${s.title}`.trim() })),
    [scenes]
  );
  const providerOptions = useMemo(
    () => [
      { value: "gemini", label: "Gemini" },
      { value: "anthropic", label: "Claude(Anthropic)" },
      { value: "deepseek", label: "DeepSeek" },
    ],
    []
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sceneScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);
  useEffect(() => {
    sceneScrollRef.current?.scrollTo({ top: sceneScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [sceneMsgs.length]);

  useEffect(() => {
    // 씬 참여자 로드
    (async () => {
      if (!sceneId) return;
      try {
        const ids = await studioLoadSceneParticipants({ sceneId });
        setSceneParticipantIds(ids);
        const first = ids[0] || "";
        setAsCharacterId((prev) => (prev && ids.includes(prev) ? prev : first));
      } catch {
        setSceneParticipantIds([]);
        setAsCharacterId("");
      }
    })();
  }, [sceneId]);

  const sendOne = async () => {
    const text = input.trim();
    if (busy || !text || !targetCharacterId) return;
    setErr(null);
    setBusy(true);
    setInput("");
    const next = [...msgs, { role: "user", content: text } as ChatMsg].filter(
      (m) => String(m.content || "").trim().length > 0
    );
    setMsgs(next);
    try {
      const out = await simChat({ provider, characterId: targetCharacterId, messages: next });
      const outText = String(out || "").trim();
      if (!outText) throw new Error("LLM이 빈 응답을 반환했어요. (키/모델/안전필터 설정 확인)");
      setMsgs((cur) => [...cur, { role: "assistant", content: outText }]);
    } catch (e: any) {
      setErr(e?.message || "실행에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const sendScene = async () => {
    const text = sceneInput.trim();
    if (sceneBusy || !text || !targetCharacterId || !sceneId) return;
    setSceneErr(null);
    setSceneBusy(true);
    setSceneInput("");
    const next = [...sceneMsgs, { role: "user", content: text } as ChatMsg].filter(
      (m) => String(m.content || "").trim().length > 0
    );
    setSceneMsgs(next);
    try {
      const out = await simChat({
        provider,
        characterId: targetCharacterId,
        sceneId,
        asCharacterId: asCharacterId || undefined,
        messages: next,
      });
      const outText = String(out || "").trim();
      if (!outText) throw new Error("LLM이 빈 응답을 반환했어요. (키/모델/안전필터 설정 확인)");
      setSceneMsgs((cur) => [...cur, { role: "assistant", content: outText }]);
    } catch (e: any) {
      setSceneErr(e?.message || "실행에 실패했어요.");
    } finally {
      setSceneBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4">
        <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">시뮬레이터</div>
        <div className="mt-1 text-[12px] font-semibold text-white/40">
          프로젝트: <span className="text-white/70">{projectTitle}</span> · Draft 데이터로 즉시 테스트
        </div>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="text-[12px] font-bold text-white/55">LLM</div>
          <StudioSelect
            value={provider}
            onChange={(v) => setProvider(v as any)}
            options={providerOptions as any}
            placeholder="Provider 선택"
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="text-[12px] font-extrabold text-white/70">주의</div>
          <div className="mt-2 text-[11px] font-semibold text-white/40">
            - Studio 시뮬레이터는 Draft(초안) 기준입니다.
            {"\n"}- API 키/LLM 설정은 /admin/llm의 global 설정을 사용합니다.
          </div>
        </div>
      </div>

      <Tabs.Root defaultValue="one" className="w-full">
        <Tabs.List className="flex items-center gap-2 border-b border-white/10 px-1 pb-3">
          <Tabs.Trigger
            value="one"
            className={cn(
              "rounded-xl px-3 py-2 text-[12px] font-extrabold text-white/45",
              "data-[state=active]:bg-white/[0.06] data-[state=active]:text-white/85"
            )}
          >
            1:1 테스트
          </Tabs.Trigger>
          <Tabs.Trigger
            value="scene"
            className={cn(
              "rounded-xl px-3 py-2 text-[12px] font-extrabold text-white/45",
              "data-[state=active]:bg-white/[0.06] data-[state=active]:text-white/85"
            )}
          >
            씬 기반 테스트
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="one" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="text-[12px] font-extrabold text-white/70">상대 캐릭터</div>
              <StudioSelect
                value={targetCharacterId}
                onChange={(v) => {
                  setMsgs([]);
                  setTargetCharacterId(v);
                }}
                options={listCastOptions}
                placeholder="캐릭터 선택"
              />
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-white/[0.06] px-4 py-3 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
                onClick={() => setMsgs([])}
              >
                대화 초기화
              </button>
              {err ? <div className="mt-3 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10">
              <div ref={scrollRef} className="studio-scrollbar h-[420px] overflow-auto p-4">
                {!msgs.length ? (
                  <div className="text-[12px] font-semibold text-white/40">메시지를 보내면 LLM 응답이 돌아옵니다.</div>
                ) : null}
                <div className="space-y-3">
                  {msgs.map((m, idx) => (
                    <ChatBubble key={idx} role={m.role} content={m.content} />
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-2 border-t border-white/10 p-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const composing = (e.nativeEvent as any)?.isComposing;
                    if (composing) return;
                    // Enter 단독: 전송 / Shift+Enter or Ctrl+Enter: 줄바꿈
                    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
                      e.preventDefault();
                      void sendOne();
                    }
                  }}
                  rows={2}
                  placeholder="메시지 입력..."
                  className="studio-scrollbar flex-1 resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[13px] font-semibold text-white/85 outline-none placeholder:text-white/25"
                />
                <button
                  type="button"
                  disabled={busy || !input.trim() || !targetCharacterId}
                  className="rounded-xl bg-[#4F7CFF] px-4 py-3 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF] disabled:opacity-50"
                  onClick={() => void sendOne()}
                >
                  {busy ? "..." : "보내기"}
                </button>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="scene" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="text-[12px] font-extrabold text-white/70">씬</div>
              <StudioSelect
                value={sceneId}
                onChange={(v) => {
                  setSceneMsgs([]);
                  setSceneId(v);
                }}
                options={listSceneOptions}
                placeholder="씬 선택"
              />

              <div className="mt-4 text-[12px] font-extrabold text-white/70">응답 캐릭터</div>
              <StudioSelect
                value={asCharacterId}
                onChange={setAsCharacterId}
                options={sceneParticipantIds.map((id) => {
                  const c = cast.find((x) => x.id === id);
                  return { value: id, label: c ? c.name : id };
                })}
                placeholder={sceneParticipantIds.length ? "응답 캐릭터 선택" : "참여 캐릭터가 없어요"}
                disabled={!sceneParticipantIds.length}
              />

              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-white/[0.06] px-4 py-3 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
                onClick={() => setSceneMsgs([])}
              >
                대화 초기화
              </button>
              {sceneErr ? <div className="mt-3 text-[12px] font-semibold text-[#ff9aa1]">{sceneErr}</div> : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10">
              <div ref={sceneScrollRef} className="studio-scrollbar h-[420px] overflow-auto p-4">
                {!sceneMsgs.length ? (
                  <div className="text-[12px] font-semibold text-white/40">
                    씬 로어북/룰 + 참여 캐릭터(그룹챗) 설정을 반영해 테스트합니다.
                  </div>
                ) : null}
                <div className="space-y-3">
                  {sceneMsgs.map((m, idx) => (
                    <ChatBubble key={idx} role={m.role} content={m.content} />
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-2 border-t border-white/10 p-3">
                <textarea
                  value={sceneInput}
                  onChange={(e) => setSceneInput(e.target.value)}
                  onKeyDown={(e) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const composing = (e.nativeEvent as any)?.isComposing;
                    if (composing) return;
                    // Enter 단독: 전송 / Shift+Enter or Ctrl+Enter: 줄바꿈
                    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
                      e.preventDefault();
                      void sendScene();
                    }
                  }}
                  rows={2}
                  placeholder="메시지 입력..."
                  className="studio-scrollbar flex-1 resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[13px] font-semibold text-white/85 outline-none placeholder:text-white/25"
                />
                <button
                  type="button"
                  disabled={sceneBusy || !sceneInput.trim() || !targetCharacterId || !sceneId}
                  className="rounded-xl bg-[#4F7CFF] px-4 py-3 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF] disabled:opacity-50"
                  onClick={() => void sendScene()}
                >
                  {sceneBusy ? "..." : "보내기"}
                </button>
              </div>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

