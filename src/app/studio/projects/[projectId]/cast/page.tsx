"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCast, getProject } from "@/lib/studio/projects";
import { cn } from "@/lib/utils/cn";
import { useStudioStore } from "@/lib/studio/store";

function StatusPill({ status }: { status: "draft" | "published" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-extrabold",
        status === "published" ? "bg-[#22c55e]/15 text-[#6ee7b7]" : "bg-white/10 text-white/55"
      )}
    >
      {status === "published" ? "배포됨" : "임시저장"}
    </span>
  );
}

export default function ProjectCastPage({ params }: { params: { projectId: string } }) {
  const project = getProject(params.projectId);
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const setSelectedCharacterId = useStudioStore((s) => s.setSelectedCharacterId);
  const [q, setQ] = useState("");

  useEffect(() => {
    setSelectedProjectId(params.projectId);
  }, [params.projectId, setSelectedProjectId]);

  const list = useMemo(() => {
    const all = getCast(params.projectId);
    const v = q.trim().toLowerCase();
    if (!v) return all;
    return all.filter((c) => c.name.toLowerCase().includes(v) || c.roleLabel.toLowerCase().includes(v));
  }, [params.projectId, q]);

  if (!project) return <div className="text-[13px] font-semibold text-white/60">프로젝트를 찾을 수 없어요.</div>;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">캐스트(캐릭터)</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">
            프로젝트: <span className="text-white/70">{project.title}</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#4F7CFF] px-4 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF]"
          onClick={() => alert("캐릭터 생성(더미)")}
        >
          + 캐릭터 추가
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
          placeholder="이름/역할 검색..."
          className="w-full bg-transparent text-[12px] font-semibold text-white/80 placeholder:text-white/25 outline-none"
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-extrabold text-white/85">{c.name}</div>
                <div className="mt-1 text-[12px] font-semibold text-white/40">{c.roleLabel}</div>
              </div>
              <StatusPill status={c.status} />
            </div>

            <div className="mt-4 text-[11px] font-semibold text-white/35">
              최근 수정: <span className="text-white/55">{c.updatedAt}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={`/studio/projects/${params.projectId}/cast/${c.id}/prompt`}
                onClick={() => setSelectedCharacterId(c.id)}
                className="rounded-xl bg-white/[0.06] px-3 py-3 text-center text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
              >
                프롬프트
              </Link>
              <Link
                href={`/studio/projects/${params.projectId}/cast/${c.id}/triggers`}
                onClick={() => setSelectedCharacterId(c.id)}
                className="rounded-xl bg-white/[0.03] px-3 py-3 text-center text-[12px] font-extrabold text-white/70 ring-1 ring-white/10 hover:bg-white/[0.05]"
              >
                변수 트리거
              </Link>
            </div>

            <div className="mt-2">
              <Link
                href={`/studio/projects/${params.projectId}/cast/${c.id}/prompt?tab=lorebook`}
                onClick={() => setSelectedCharacterId(c.id)}
                className="block rounded-xl bg-white/[0.02] px-3 py-3 text-center text-[12px] font-extrabold text-white/60 ring-1 ring-white/10 hover:bg-white/[0.04]"
              >
                로어북(캐릭터)
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

