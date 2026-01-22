"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useStudioStore } from "@/lib/studio/store";

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
      if (projectId) project = projectId;

      const section = seg[3];
      if (!projectId) pageLabel = "프로젝트";
      else if (!section) pageLabel = "프로젝트";
      else if (section === "cast") {
        pageLabel = "캐스트";
        const characterId = seg[4];
        if (characterId) {
          characterName = characterId;
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
      if (!project && selectedProjectId) project = selectedProjectId;
      if (!characterName && selectedId) characterName = selectedId;

      return { project, characterName, pageLabel };
    }

    if (seg[1] === "characters") {
      const characterId = seg[2];
      if (characterId) {
        characterName = characterId;
      }
      const section = seg[3];
      if (section === "prompt") pageLabel = "프롬프트 에디터";
      else if (section === "triggers") pageLabel = "변수 트리거";
      else pageLabel = "캐스트 검색";
    } else {
      pageLabel = "대시보드";
    }

    // 캐릭터 리스트에서는 "프로젝트 › 캐릭터" 크럼을 끼워넣지 않음 (혼동 방지)
    // 대시보드에서는 컨텍스트가 있으면 마지막 선택 캐릭터를 참고로 보여줄 수 있음
    if (!isCharacterList && isDashboard && !characterName && selectedId) {
      project = selectedProjectId || project;
      characterName = selectedId;
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
      </div>
    </header>
  );
}

