"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/studio/store";
import { studioGetProject, studioListCharacters, studioListScenes } from "@/lib/studio/db";
import type { StudioCharacterRow, StudioProjectRow, StudioSceneRow } from "@/lib/studio/db";
import { ProjectSimulatorClient } from "./ui";

export default function ProjectSimulatorPage({ params }: { params: { projectId: string } }) {
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const [project, setProject] = useState<StudioProjectRow | null>(null);
  const [cast, setCast] = useState<StudioCharacterRow[] | null>(null);
  const [scenes, setScenes] = useState<StudioSceneRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setSelectedProjectId(params.projectId);
    (async () => {
      try {
        setErr(null);
        const [p, cs, ss] = await Promise.all([
          studioGetProject(params.projectId),
          studioListCharacters({ projectId: params.projectId }),
          studioListScenes({ projectId: params.projectId }),
        ]);
        setProject(p);
        setCast(cs);
        setScenes(ss);
        if (!p) setErr("프로젝트를 찾을 수 없어요.");
      } catch (e: any) {
        setErr(e?.message || "불러오지 못했어요.");
        setProject(null);
        setCast(null);
        setScenes(null);
      }
    })();
  }, [params.projectId, setSelectedProjectId]);

  if (err) return <div className="text-[13px] font-semibold text-white/60">{err}</div>;
  if (!project || !cast || !scenes) return <div className="text-[13px] font-semibold text-white/60">불러오는 중...</div>;

  return <ProjectSimulatorClient projectTitle={project.title} projectId={params.projectId} cast={cast} scenes={scenes} />;
}

