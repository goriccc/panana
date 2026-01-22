"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/studio/store";
import { TriggerRuleBuilder } from "@/app/studio/_components/TriggerRuleBuilder";
import { studioGetProject, studioLoadProjectRules, studioSaveProjectRules } from "@/lib/studio/db";
import type { StudioProjectRow } from "@/lib/studio/db";

export default function ProjectRulesPage({ params }: { params: { projectId: string } }) {
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const rules = useStudioStore((s) => s.getProjectRules(params.projectId));
  const setRules = useStudioStore((s) => s.setProjectRules);
  const [project, setProject] = useState<StudioProjectRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    setSelectedProjectId(params.projectId);
    (async () => {
      try {
        setErr(null);
        setOkMsg(null);
        const p = await studioGetProject(params.projectId);
        setProject(p);
        if (!p) setErr("프로젝트를 찾을 수 없어요.");

        const dbRules = await studioLoadProjectRules(params.projectId);
        if (dbRules && Array.isArray((dbRules as any).rules)) {
          setRules(params.projectId, dbRules);
        } else {
          // DB가 비어있으면 seed 유지
        }
      } catch (e: any) {
        setErr(e?.message || "프로젝트를 불러오지 못했어요.");
      }
    })();
  }, [params.projectId, setSelectedProjectId]);

  if (err) return <div className="text-[13px] font-semibold text-white/60">{err}</div>;
  if (!project) return <div className="text-[13px] font-semibold text-white/60">불러오는 중...</div>;

  const canSave = Boolean(rules && Array.isArray((rules as any).rules));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          {okMsg ? <div className="text-[12px] font-semibold text-[#6ee7b7]">{okMsg}</div> : null}
          {busy ? <div className="text-[12px] font-semibold text-white/40">저장 중...</div> : null}
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#4F7CFF] px-4 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF] disabled:opacity-50"
          disabled={!canSave || busy}
          onClick={async () => {
            setErr(null);
            setOkMsg(null);
            setBusy(true);
            try {
              await studioSaveProjectRules(params.projectId, rules);
              setOkMsg("저장 완료!");
            } catch (e: any) {
              setErr(e?.message || "저장에 실패했어요.");
            } finally {
              setBusy(false);
            }
          }}
        >
          저장
        </button>
      </div>
      <TriggerRuleBuilder
        title="프로젝트 룰(트리거)"
        subtitle="프로젝트 전역에 적용되는 IF-THEN 규칙입니다. 캐릭터/씬에서 override 또는 추가로 보정할 수 있어요."
        value={rules}
        onChange={(next) => setRules(params.projectId, next)}
        labelScope="project"
      />
    </div>
  );
}

