"use client";

import Link from "next/link";
import { getProject } from "@/lib/studio/projects";
import { useEffect } from "react";
import { useStudioStore } from "@/lib/studio/store";

export default function StudioProjectHomePage({ params }: { params: { projectId: string } }) {
  const project = getProject(params.projectId);
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);

  useEffect(() => {
    setSelectedProjectId(params.projectId);
  }, [params.projectId, setSelectedProjectId]);

  if (!project) {
    return <div className="text-[13px] font-semibold text-white/60">프로젝트를 찾을 수 없어요.</div>;
  }

  return (
    <div>
      <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">{project.title}</div>
      <div className="mt-1 text-[12px] font-semibold text-white/40">{project.subtitle}</div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href={`/studio/projects/${project.id}/cast`}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
        >
          <div className="text-[14px] font-extrabold text-white/85">캐스트(캐릭터)</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">여러 캐릭터를 생성/관리</div>
        </Link>
        <Link
          href={`/studio/projects/${project.id}/lorebook`}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
        >
          <div className="text-[14px] font-extrabold text-white/85">프로젝트 로어북</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">세계관 공통 지식(DB)</div>
        </Link>
        <Link
          href={`/studio/projects/${project.id}/rules`}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
        >
          <div className="text-[14px] font-extrabold text-white/85">프로젝트 룰(트리거)</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">전역 IF-THEN 규칙</div>
        </Link>
        <Link
          href={`/studio/projects/${project.id}/scenes`}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
        >
          <div className="text-[14px] font-extrabold text-white/85">씬(드라마)</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">씬별 진행 + 그룹챗 구성</div>
        </Link>
        <Link
          href={`/studio/projects/${project.id}/simulator`}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
        >
          <div className="text-[14px] font-extrabold text-white/85">시뮬레이터</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">1:1 / 그룹챗 테스트</div>
        </Link>
      </div>
    </div>
  );
}

