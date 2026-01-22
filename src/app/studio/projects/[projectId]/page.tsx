"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/studio/store";
import { studioDeleteProject, studioGetProject } from "@/lib/studio/db";
import type { StudioProjectRow } from "@/lib/studio/db";
import { StudioConfirmDialog } from "@/app/studio/_components/StudioDialogs";

export default function StudioProjectHomePage({ params }: { params: { projectId: string } }) {
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const [project, setProject] = useState<StudioProjectRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setSelectedProjectId(params.projectId);
    (async () => {
      try {
        setErr(null);
        const p = await studioGetProject(params.projectId);
        setProject(p);
        if (!p) setErr("프로젝트를 찾을 수 없어요.");
      } catch (e: any) {
        setErr(e?.message || "프로젝트를 불러오지 못했어요.");
      }
    })();
  }, [params.projectId, setSelectedProjectId]);

  if (err) return <div className="text-[13px] font-semibold text-white/60">{err}</div>;
  if (!project) return <div className="text-[13px] font-semibold text-white/60">불러오는 중...</div>;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">{project.title}</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">{project.subtitle}</div>
        </div>
        <button
          type="button"
          className="text-[12px] font-extrabold text-[#ff9aa1] hover:text-[#ff6b78] disabled:opacity-50"
          disabled={busy}
          onClick={async () => {
            setErr(null);
            setConfirmOpen(true);
          }}
        >
          삭제
        </button>
      </div>

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

      <StudioConfirmDialog
        open={confirmOpen}
        title="프로젝트를 삭제할까요?"
        description={`- 프로젝트: ${project.title}\n- 포함된 캐릭터/씬/로어북/트리거도 함께 삭제될 수 있어요.\n- 복구 불가`}
        destructive
        confirmText="삭제"
        busy={busy}
        onClose={() => {
          if (busy) return;
          setConfirmOpen(false);
        }}
        onConfirm={async () => {
          setErr(null);
          setBusy(true);
          try {
            await studioDeleteProject({ projectId: params.projectId });
            setSelectedProjectId(null);
            window.location.href = "/studio/projects";
          } catch (e: any) {
            setErr(e?.message || "삭제에 실패했어요.");
          } finally {
            setBusy(false);
            setConfirmOpen(false);
          }
        }}
      />
    </div>
  );
}

