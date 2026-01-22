"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/studio/store";
import { LorebookManager } from "@/app/studio/_components/LorebookManager";
import { studioGetProject, studioLoadProjectLorebook, studioSaveProjectLorebook } from "@/lib/studio/db";
import type { StudioProjectRow } from "@/lib/studio/db";

export default function ProjectLorebookPage({ params }: { params: { projectId: string } }) {
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const rows = useStudioStore((s) => s.getProjectLorebook(params.projectId));
  const setRows = useStudioStore((s) => s.setProjectLorebook);
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

        const dbRows = await studioLoadProjectLorebook(params.projectId);
        if (dbRows.length) {
          // store 타입(mergeMode 필수)에 맞춰 보정
          setRows(
            params.projectId,
            dbRows.map((r) => ({ ...r, mergeMode: (r as any).mergeMode === "append" ? "append" : "override" })) as any
          );
        } else {
          // DB가 비어있으면 기존 seed 유지(사용자에게는 "아무것도 없음"처럼 보이므로 seed를 유지)
          // 필요하면 이후에 "빈 로어북" UX로 바꿀 수 있음.
        }
      } catch (e: any) {
        setErr(e?.message || "프로젝트를 불러오지 못했어요.");
      }
    })();
  }, [params.projectId, setSelectedProjectId]);

  if (err) return <div className="text-[13px] font-semibold text-white/60">{err}</div>;
  if (!project) return <div className="text-[13px] font-semibold text-white/60">불러오는 중...</div>;

  const canSave = Array.isArray(rows);

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
              await studioSaveProjectLorebook(
                params.projectId,
                (rows || []).map((r: any) => ({
                  id: r.id,
                  key: r.key,
                  value: r.value,
                  mergeMode: r.mergeMode || "override",
                  unlock: r.unlock,
                }))
              );
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

