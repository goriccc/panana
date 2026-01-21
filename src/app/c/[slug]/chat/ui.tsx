"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { id: string; from: "bot" | "user"; text: string };

function Bubble({ from, text }: { from: Msg["from"]; text: string }) {
  if (from === "user") {
    return (
      <div className="ml-auto max-w-[290px]">
        <div className="rounded-2xl bg-panana-pink px-4 py-3 text-[14px] font-semibold leading-[1.45] text-[#0B0C10]">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="mr-auto flex max-w-[320px] items-end gap-2">
      <div className="h-9 w-9 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10" />
      <div className="rounded-2xl bg-white/[0.06] px-4 py-3 text-[14px] font-semibold leading-[1.45] text-white/80">
        {text}
      </div>
    </div>
  );
}

export function CharacterChatClient({
  characterName,
  backHref,
}: {
  characterName: string;
  backHref: string;
}) {
  const [value, setValue] = useState("니가 사는 밥");
  const [messages, setMessages] = useState<Msg[]>(
    () => [
      { id: "u1", from: "user", text: "어제 하루 종일 잘못했어 ㅠㅠ" },
      { id: "b1", from: "bot", text: "피곤했구낭" },
      { id: "b2", from: "bot", text: "오늘은 모해??" },
      { id: "u2", from: "user", text: "글세 아직 안 정함" },
      { id: "b3", from: "bot", text: "나랑 밥 먹자!" },
      { id: "u3", from: "user", text: "그래 밥은 니가사는걸로 ㅋㅋㅋㅋ" },
    ],
  );

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = () => {
    const text = value.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, from: "user", text }]);
    setValue("");

    // TODO: 실제 AI 연동 시 제거/대체
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, from: "bot", text: "오키 ㅎㅎ" }]);
    }, 450);
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
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
      </header>

      <main className="mx-auto w-full max-w-[420px] px-5 pb-28 pt-4">
        <div className="space-y-3">
          {messages.map((m) => (
            <Bubble key={m.id} from={m.from} text={m.text} />
          ))}
          <div ref={endRef} />
        </div>
      </main>

      {/* composer */}
      <div className="fixed bottom-0 left-0 right-0 pb-[max(env(safe-area-inset-bottom),16px)]">
        <div className="mx-auto w-full max-w-[420px] px-5">
          <div className="flex items-center gap-3 rounded-full border border-panana-pink/35 bg-white/[0.04] px-4 py-3 backdrop-blur">
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
              disabled={!value.trim()}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 12h12"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
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

