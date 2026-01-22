"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/studio/store";
import { studioCreateScene, studioGetProject, studioListScenes } from "@/lib/studio/db";
import type { StudioProjectRow, StudioSceneRow } from "@/lib/studio/db";
import { StudioFormDialog } from "@/app/studio/_components/StudioDialogs";

export default function ProjectScenesPage({ params }: { params: { projectId: string } }) {
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const [project, setProject] = useState<StudioProjectRow | null>(null);
  const [scenes, setScenes] = useState<StudioSceneRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newEpisode, setNewEpisode] = useState("EP1");

  useEffect(() => {
    setSelectedProjectId(params.projectId);
    (async () => {
      try {
        setErr(null);
        const [p, ss] = await Promise.all([studioGetProject(params.projectId), studioListScenes({ projectId: params.projectId })]);
        setProject(p);
        setScenes(ss);
        if (!p) setErr("프로젝트를 찾을 수 없어요.");
      } catch (e: any) {
        setErr(e?.message || "불러오지 못했어요.");
        setProject(null);
        setScenes(null);
      }
    })();
  }, [params.projectId, setSelectedProjectId]);

  if (err) return <div className="text-[13px] font-semibold text-white/60">{err}</div>;
  if (!project || !scenes) return <div className="text-[13px] font-semibold text-white/60">불러오는 중...</div>;

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
          onClick={async () => {
            setErr(null);
            setNewTitle("");
            setNewSlug("");
            setNewEpisode("EP1");
            setCreateOpen(true);
          }}
        >
          + 새 씬
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!scenes.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-[12px] font-semibold text-white/55">
            씬이 없어요. 오른쪽 위의 <span className="text-white/75">+ 새 씬</span>으로 만들어주세요.
          </div>
        ) : null}
        {scenes.map((s) => (
          <Link
            key={s.id}
            href={`/studio/projects/${params.projectId}/scenes/${s.id}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
          >
            <div className="text-[12px] font-extrabold text-white/45">{s.episode_label || ""}</div>
            <div className="mt-1 text-[14px] font-extrabold text-white/85">{s.title}</div>
            <div className="mt-4 text-[11px] font-semibold text-white/35">
              최근 수정: <span className="text-white/55">{(s.updated_at || "").slice(0, 10) || ""}</span>
            </div>
          </Link>
        ))}
      </div>

      <StudioFormDialog
        open={createOpen}
        title="새 씬 만들기"
        description={`프로젝트: ${project?.title || ""}`}
        submitText="생성"
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onSubmit={async () => {
          const title = newTitle.trim();
          const slug = newSlug.trim();
          if (!title) {
            setErr("씬 제목을 입력하세요.");
            return;
          }
          if (!slug) {
            setErr("slug를 입력하세요.");
            return;
          }
          setErr(null);
          setBusy(true);
          try {
            await studioCreateScene({ projectId: params.projectId, title, slug, episodeLabel: newEpisode.trim() });
            const ss = await studioListScenes({ projectId: params.projectId });
            setScenes(ss);
            setCreateOpen(false);
          } catch (e: any) {
            setErr(e?.message || "생성에 실패했어요.");
          } finally {
            setBusy(false);
          }
        }}
        fields={[
          { label: "씬 제목", value: newTitle, placeholder: "예: EP1 덫", autoFocus: true, onChange: setNewTitle },
          { label: "slug", value: newSlug, placeholder: "예: ep1-trap", helperText: "영문/숫자/하이픈", onChange: setNewSlug },
          { label: "에피소드 라벨", value: newEpisode, placeholder: "예: EP1", onChange: setNewEpisode },
        ]}
      />
    </div>
  );
}

