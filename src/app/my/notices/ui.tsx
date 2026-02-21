"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { notices } from "@/lib/notices";

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-current">
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NoticesClient() {
  const list = useMemo(() => notices, []);
  const [safetyOn, setSafetyOn] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const v = document.cookie.split("; ").find((row) => row.startsWith("panana_safety_on="));
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
  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link href="/my" aria-label="뒤로가기" className={`absolute left-0 p-2 ${headerAccent}`}>
            <BackIcon />
          </Link>
          <div className={`mx-auto text-[18px] font-semibold tracking-[-0.01em] ${headerAccent}`}>공지사항</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[420px] px-0 pb-16 pt-2">
        <div className="divide-y divide-white/10 border-t border-white/10">
          {list.map((n) => (
            <Link
              key={n.id}
              href={`/my/notices/${n.id}`}
              className="flex items-center justify-between gap-4 px-5 py-5"
            >
              <div className="min-w-0 text-[14px] font-semibold text-white/80">{n.title}</div>
              <div className="shrink-0 text-[12px] font-semibold text-white/35">{n.date}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

