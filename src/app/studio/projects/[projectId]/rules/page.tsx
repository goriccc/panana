"use client";

import { useEffect } from "react";
import { getProject } from "@/lib/studio/projects";
import { useStudioStore } from "@/lib/studio/store";
import { TriggerRuleBuilder } from "@/app/studio/_components/TriggerRuleBuilder";

export default function ProjectRulesPage({ params }: { params: { projectId: string } }) {
  const project = getProject(params.projectId);
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const rules = useStudioStore((s) => s.getProjectRules(params.projectId));
  const setRules = useStudioStore((s) => s.setProjectRules);

  useEffect(() => {
    setSelectedProjectId(params.projectId);
  }, [params.projectId, setSelectedProjectId]);

  if (!project) return <div className="text-[13px] font-semibold text-white/60">프로젝트를 찾을 수 없어요.</div>;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <TriggerRuleBuilder
        title="프로젝트 룰(트리거)"
        subtitle="프로젝트 전역에 적용되는 IF-THEN 규칙입니다. 캐릭터/씬에서 override 또는 추가로 보정할 수 있어요."
        value={rules}
        onChange={(next) => setRules(params.projectId, next)}
      />
    </div>
  );
}

