"use client";

import Link from "next/link";
import { useEffect } from "react";
import { getCast, getProject, getScenes } from "@/lib/studio/projects";
import { useStudioStore } from "@/lib/studio/store";

export default function ProjectSimulatorPage({ params }: { params: { projectId: string } }) {
  const project = getProject(params.projectId);
  const cast = getCast(params.projectId);
  const scenes = getScenes(params.projectId);
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);

  useEffect(() => {
    setSelectedProjectId(params.projectId);
  }, [params.projectId, setSelectedProjectId]);

  if (!project) return <div className="text-[13px] font-semibold text-white/60">프로젝트를 찾을 수 없어요.</div>;

  return (
    <div>
      <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">시뮬레이터</div>
      <div className="mt-1 text-[12px] font-semibold text-white/40">
        프로젝트: <span className="text-white/70">{project.title}</span> · 1:1 기본 + 씬 기반 그룹챗 확장
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[13px] font-extrabold text-white/80">1:1 테스트</div>
          <div className="mt-2 text-[12px] font-semibold text-white/45">상대 캐릭터를 선택해 테스트하는 흐름(초기 UI).</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {cast.map((c) => (
              <Link
                key={c.id}
                href={`/studio/projects/${params.projectId}/cast/${c.id}/prompt`}
                className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-[12px] font-extrabold text-white/75 hover:bg-black/20"
              >
                {c.name} <span className="text-white/35">({c.roleLabel})</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[13px] font-extrabold text-white/80">씬 기반 그룹챗</div>
          <div className="mt-2 text-[12px] font-semibold text-white/45">씬을 선택해 참여 캐릭터 구성/룰/로어가 반영되는 테스트(초기 UI).</div>
          <div className="mt-4 grid gap-2">
            {scenes.map((s) => (
              <Link
                key={s.id}
                href={`/studio/projects/${params.projectId}/scenes/${s.id}`}
                className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-[12px] font-extrabold text-white/75 hover:bg-black/20"
              >
                {s.episodeLabel} · {s.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

