"use client";

import Link from "next/link";
import { useEffect } from "react";
import { getProject, getScenes } from "@/lib/studio/projects";
import { useStudioStore } from "@/lib/studio/store";

export default function ProjectScenesPage({ params }: { params: { projectId: string } }) {
  const project = getProject(params.projectId);
  const scenes = getScenes(params.projectId);
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);

  useEffect(() => {
    setSelectedProjectId(params.projectId);
  }, [params.projectId, setSelectedProjectId]);

  if (!project) return <div className="text-[13px] font-semibold text-white/60">프로젝트를 찾을 수 없어요.</div>;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">씬(드라마)</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">
            프로젝트: <span className="text-white/70">{project.title}</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#4F7CFF] px-4 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF]"
          onClick={() => alert("새 씬 생성(더미)")}
        >
          + 새 씬
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((s) => (
          <Link
            key={s.id}
            href={`/studio/projects/${params.projectId}/scenes/${s.id}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
          >
            <div className="text-[12px] font-extrabold text-white/45">{s.episodeLabel}</div>
            <div className="mt-1 text-[14px] font-extrabold text-white/85">{s.title}</div>
            <div className="mt-4 text-[11px] font-semibold text-white/35">
              최근 수정: <span className="text-white/55">{s.updatedAt}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

