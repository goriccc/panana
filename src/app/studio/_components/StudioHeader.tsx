"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { studioCharacters } from "@/lib/studio/characters";
import { useStudioStore } from "@/lib/studio/store";
import { getCastMember, getProject } from "@/lib/studio/projects";

function Crumb({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return <span className={dim ? "text-[12px] font-semibold text-white/35" : "text-[12px] font-semibold text-white/55"}>{children}</span>;
}

function Sep() {
  return <span className="text-[12px] font-semibold text-white/25">›</span>;
}

export function StudioHeader() {
  const pathname = usePathname();
  const selectedId = useStudioStore((s) => s.selectedCharacterId);
  const selectedProjectId = useStudioStore((s) => s.selectedProjectId);

  const { project, characterName, pageLabel } = useMemo(() => {
    const seg = pathname.split("/").filter(Boolean); // ["studio", ...]
    let project = "";
    let characterName = "";
    let pageLabel = "";
    const isCharacterList = pathname === "/studio/characters";
    const isDashboard = pathname === "/studio";
    const isProjectList = pathname === "/studio/projects";

    if (seg[0] !== "studio") return { project, characterName, pageLabel };

    // New: projects 중심 IA
    if (seg[1] === "projects") {
      const projectId = seg[2];
      if (projectId) {
        const p = getProject(projectId);
        project = p?.title || projectId;
      }

      const section = seg[3];
      if (!projectId) pageLabel = "프로젝트";
      else if (!section) pageLabel = "프로젝트";
      else if (section === "cast") {
        pageLabel = "캐스트";
        const characterId = seg[4];
        if (characterId) {
          const c = getCastMember(projectId, characterId);
          characterName = c?.name || characterId;
          const deep = seg[5];
          if (deep === "prompt") pageLabel = "프롬프트 에디터";
          else if (deep === "triggers") pageLabel = "변수 트리거";
        }
      } else if (section === "lorebook") pageLabel = "프로젝트 로어북";
      else if (section === "rules") pageLabel = "프로젝트 룰";
      else if (section === "scenes") pageLabel = "씬";
      else if (section === "simulator") pageLabel = "시뮬레이터";
      else pageLabel = "프로젝트";

      // projects 라우트에서는 선택 컨텍스트 보정
      if (!project && selectedProjectId) {
        const p = getProject(selectedProjectId);
        project = p?.title || project;
      }
      if (!characterName && selectedId && projectId) {
        const c = getCastMember(projectId, selectedId);
        characterName = c?.name || characterName;
      }

      return { project, characterName, pageLabel };
    }

    if (seg[1] === "characters") {
      const characterId = seg[2];
      if (characterId) {
        const c = studioCharacters.find((x) => x.id === characterId);
        project = c?.genre || "";
        characterName = c?.name || characterId;
      }
      const section = seg[3];
      if (section === "prompt") pageLabel = "프롬프트 에디터";
      else if (section === "triggers") pageLabel = "변수 트리거";
      else pageLabel = "캐릭터 관리";
    } else if (seg[1] === "analytics") {
      pageLabel = "통계/분석";
    } else {
      pageLabel = "대시보드";
    }

    // 캐릭터 리스트에서는 "프로젝트 › 캐릭터" 크럼을 끼워넣지 않음 (혼동 방지)
    // 대시보드에서는 컨텍스트가 있으면 마지막 선택 캐릭터를 참고로 보여줄 수 있음
    if (!isCharacterList && isDashboard && !characterName && selectedId) {
      const c = studioCharacters.find((x) => x.id === selectedId);
      project = c?.genre || project;
      characterName = c?.name || characterName;
    }
    if (isProjectList) {
      pageLabel = "프로젝트";
    }

    return { project, characterName, pageLabel };
  }, [pathname, selectedId, selectedProjectId]);

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-black/30 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 text-[13px] font-extrabold tracking-[-0.01em] text-white/85">PananaAI Studio</div>
          <div className="flex min-w-0 items-center gap-2">
            {project ? <Crumb dim>{project}</Crumb> : null}
            {project && characterName ? <Sep /> : null}
            {characterName ? <Crumb>{characterName}</Crumb> : null}
            {(project || characterName) && pageLabel ? <Sep /> : null}
            {pageLabel ? <Crumb>{pageLabel}</Crumb> : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
          >
            임시저장
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#4F7CFF] px-3 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF]"
          >
            배포하기
          </button>
          <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <span className="text-[12px] font-extrabold text-white/70">R</span>
          </div>
        </div>
      </div>
    </header>
  );
}

