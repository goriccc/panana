"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useMemo } from "react";
import { PromptSystemTab } from "./views/PromptSystemTab";
import { LorebookTab } from "./views/LorebookTab";
import { AuthorNoteTab } from "./views/AuthorNoteTab";
import { cn } from "@/lib/utils/cn";
import { useStudioStore } from "@/lib/studio/store";
import { useEffect } from "react";

export function PromptEditorClient({
  characterId,
  initialTab,
}: {
  characterId: string;
  initialTab?: string;
}) {
  const setSelectedId = useStudioStore((s) => s.setSelectedCharacterId);
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);

  useEffect(() => {
    setSelectedId(characterId);
    // 프로젝트 컨텍스트는 별도 페이지에서 관리하되, 여기선 localStorage 복구만 수행
    try {
      const v = window.localStorage.getItem("studio_selected_project_id");
      if (v) setSelectedProjectId(v);
    } catch {}
  }, [characterId, setSelectedId]);

  const tab = useMemo(() => {
    if (initialTab === "lorebook") return "lorebook";
    if (initialTab === "author") return "author";
    return "system";
  }, [initialTab]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">프롬프트 에디터 (Prompt Editor)</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">
            캐릭터: <span className="text-white/70">{characterId}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
        <Tabs.Root defaultValue={tab} className="w-full">
          <Tabs.List className="flex items-center gap-2 border-b border-white/10 px-4 pt-3">
            {[
              { v: "system", label: "① 시스템 프롬프트 (자아)" },
              { v: "lorebook", label: "② 로어북 (세계관 DB)" },
              { v: "author", label: "③ 오서 노트 (형식)" },
            ].map((t) => (
              <Tabs.Trigger
                key={t.v}
                value={t.v}
                className={cn(
                  "relative -mb-px rounded-t-xl px-3 py-2 text-[12px] font-extrabold text-white/45 outline-none",
                  "data-[state=active]:text-[#8FB1FF]",
                  "data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-[1px] data-[state=active]:after:h-[2px] data-[state=active]:after:bg-[#4F7CFF]"
                )}
              >
                {t.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="system" className="p-5">
            <PromptSystemTab characterId={characterId} />
          </Tabs.Content>
          <Tabs.Content value="lorebook" className="p-5">
            <LorebookTab characterId={characterId} />
          </Tabs.Content>
          <Tabs.Content value="author" className="p-5">
            <AuthorNoteTab characterId={characterId} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}

