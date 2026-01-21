"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { studioProjects } from "@/lib/studio/projects";

export default function StudioProjectsPage() {
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const v = q.trim().toLowerCase();
    if (!v) return studioProjects;
    return studioProjects.filter((p) => p.title.toLowerCase().includes(v) || (p.subtitle || "").toLowerCase().includes(v));
  }, [q]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">프로젝트(세계관)</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">
            세계관(프로젝트) 아래에 캐스트(여러 캐릭터)와 씬(드라마 진행)을 구성합니다.
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#4F7CFF] px-4 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF]"
          onClick={() => alert("새 프로젝트 생성(더미)")}
        >
          + 새 프로젝트
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="프로젝트 검색..."
          className="w-full bg-transparent text-[12px] font-semibold text-white/80 placeholder:text-white/25 outline-none"
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/studio/projects/${p.id}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
          >
            <div className="text-[14px] font-extrabold text-white/85">{p.title}</div>
            <div className="mt-1 text-[12px] font-semibold text-white/40">{p.subtitle}</div>
            <div className="mt-4 text-[11px] font-semibold text-white/35">
              최근 수정: <span className="text-white/55">{p.updatedAt}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

