"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useMemo, useState } from "react";
import { PromptSystemTab } from "./views/PromptSystemTab";
import { LorebookTab } from "./views/LorebookTab";
import { TriggerBuilderClient } from "../triggers/ui";
import { AuthorNoteTab } from "./views/AuthorNoteTab";
import { OperatorMemoTab } from "./views/OperatorMemoTab";
import { cn } from "@/lib/utils/cn";
import { useStudioStore } from "@/lib/studio/store";
import { useEffect } from "react";
import { studioLoadPromptPayload } from "@/lib/studio/db";
import type { StudioPromptState } from "@/lib/studio/types";

export function PromptEditorClient({
  characterId,
  initialTab,
}: {
  characterId: string;
  initialTab?: string;
}) {
  const setSelectedId = useStudioStore((s) => s.setSelectedCharacterId);
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const setPrompt = useStudioStore((s) => s.setPrompt);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mergePrompt = (base: StudioPromptState, patch: Partial<StudioPromptState> | null): StudioPromptState => {
    if (!patch) return base;
    const sys = patch.system || {};
    const author = patch.author || {};
    const meta = patch.meta || {};
    return {
      ...base,
      system: {
        ...base.system,
        ...sys,
        fewShotPairs: Array.isArray((sys as any).fewShotPairs) ? (sys as any).fewShotPairs : base.system.fewShotPairs,
      },
      author: {
        ...base.author,
        ...author,
      },
      meta: {
        ...(base.meta || {}),
        ...(meta || {}),
      },
      // lorebook은 별도 테이블에서 관리
      lorebook: base.lorebook,
    };
  };

  useEffect(() => {
    setSelectedId(characterId);
    // 프로젝트 컨텍스트는 별도 페이지에서 관리하되, 여기선 localStorage 복구만 수행
    try {
      const v = window.localStorage.getItem("studio_selected_project_id");
      if (v) setSelectedProjectId(v);
    } catch {}
  }, [characterId, setSelectedId, setSelectedProjectId]);

  useEffect(() => {
    // DB → store 로드(1회). 없으면 seedPrompt 유지
    let alive = true;
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const { payload } = await studioLoadPromptPayload(characterId);
        if (!alive) return;
        if (!payload) return;
        const current = useStudioStore.getState().getPrompt(characterId);
        setPrompt(characterId, mergePrompt(current, payload));
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "프롬프트 데이터를 불러오지 못했어요.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const tab = useMemo(() => {
    if (initialTab === "lorebook") return "lorebook";
    if (initialTab === "triggers") return "triggers";
    if (initialTab === "author") return "author";
    if (initialTab === "memo") return "memo";
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
          {loading ? <div className="mt-2 text-[12px] font-semibold text-white/35">DB에서 프롬프트를 불러오는 중...</div> : null}
          {err ? <div className="mt-2 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
        <Tabs.Root defaultValue={tab} className="w-full">
          <Tabs.List className="flex items-center gap-2 border-b border-white/10 px-4 pt-3">
            {[
              { v: "system", label: "① 시스템 프롬프트 (자아)" },
              { v: "lorebook", label: "② 로어북 (세계관 DB)" },
              { v: "triggers", label: "③ 변수 트리거 (IF-THEN)" },
              { v: "author", label: "④ 오서 노트 (형식)" },
              { v: "memo", label: "⑤ 운영자 메모" },
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
          <Tabs.Content value="triggers" className="p-5">
            <TriggerBuilderClient characterId={characterId} embedded />
          </Tabs.Content>
          <Tabs.Content value="author" className="p-5">
            <AuthorNoteTab characterId={characterId} />
          </Tabs.Content>
          <Tabs.Content value="memo" className="p-5">
            <OperatorMemoTab characterId={characterId} />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}

