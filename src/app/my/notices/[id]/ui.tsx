"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getNotice, getNoticeNav, notices } from "@/lib/notices";

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

export function NoticeDetailClient({ id }: { id: string }) {
  const notice = useMemo(() => getNotice(id)!, [id]);
  const nav = useMemo(() => getNoticeNav(id), [id]);
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

  const prevHref = nav.prev ? `/my/notices/${nav.prev.id}` : undefined;
  const nextHref = nav.next ? `/my/notices/${nav.next.id}` : undefined;

  // 헤더 우측 날짜 포맷(스샷: 2026/01/19 형태가 필요하면 data에서 그 포맷으로 넣으면 됨)
  const date = notice.date.replaceAll(".", "/");

  const headerAccent = safetyOn ? "text-panana-pink2" : "text-[#ffa9d6]";
  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link href="/my/notices" aria-label="뒤로가기" className={`absolute left-0 p-2 ${headerAccent}`}>
            <BackIcon />
          </Link>
          <div className={`mx-auto text-[18px] font-semibold tracking-[-0.01em] ${headerAccent}`}>공지사항</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[420px] px-5 pb-20 pt-2">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[14px] font-extrabold text-white/90">{notice.title}</div>
          <div className="text-[12px] font-semibold text-white/35">{date}</div>
        </div>

        <div className="mt-5 whitespace-pre-line text-[12px] leading-[1.75] text-white/60">
          {notice.body}
        </div>

        <div className="mt-10 flex items-center justify-between">
          {prevHref ? (
            <Link href={prevHref} className="text-[13px] font-bold text-[#ffa9d6]">
              이전 글
            </Link>
          ) : (
            <span className="text-[13px] font-bold text-white/20">이전 글</span>
          )}

          {nextHref ? (
            <Link href={nextHref} className="text-[13px] font-bold text-[#ffa9d6]">
              다음 글
            </Link>
          ) : (
            <span className="text-[13px] font-bold text-white/20">다음 글</span>
          )}
        </div>

        {/* 마지막 글에서도 하단 여백이 유지되도록 */}
        <div className="h-10" />
      </main>
    </div>
  );
}

