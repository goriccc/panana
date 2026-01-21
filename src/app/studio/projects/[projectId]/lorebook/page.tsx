"use client";

import { useEffect } from "react";
import { getProject } from "@/lib/studio/projects";
import { useStudioStore } from "@/lib/studio/store";
import { LorebookManager } from "@/app/studio/_components/LorebookManager";

export default function ProjectLorebookPage({ params }: { params: { projectId: string } }) {
  const project = getProject(params.projectId);
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const rows = useStudioStore((s) => s.getProjectLorebook(params.projectId));
  const setRows = useStudioStore((s) => s.setProjectLorebook);

  useEffect(() => {
    setSelectedProjectId(params.projectId);
  }, [params.projectId, setSelectedProjectId]);

  if (!project) return <div className="text-[13px] font-semibold text-white/60">프로젝트를 찾을 수 없어요.</div>;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <LorebookManager
        title="프로젝트 로어북"
        subtitle="세계관 공통 지식(DB)입니다. 캐릭터/씬에서 같은 키를 override(덮어쓰기)하거나 append(합치기)할 수 있어요."
        listId={`project-sku-${params.projectId}`}
        rows={rows}
        onChange={(next) => setRows(params.projectId, next)}
        showMergeMode
      />
    </div>
  );
}

