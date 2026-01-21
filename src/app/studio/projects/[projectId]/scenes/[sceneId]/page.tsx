"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useMemo } from "react";
import { getProject, getScenes, getCast } from "@/lib/studio/projects";
import { useStudioStore } from "@/lib/studio/store";
import { cn } from "@/lib/utils/cn";
import { LorebookManager } from "@/app/studio/_components/LorebookManager";
import { TriggerRuleBuilder } from "@/app/studio/_components/TriggerRuleBuilder";

export default function SceneEditorPage({ params }: { params: { projectId: string; sceneId: string } }) {
  const project = getProject(params.projectId);
  const sceneMeta = getScenes(params.projectId).find((s) => s.id === params.sceneId) ?? null;
  const cast = getCast(params.projectId);

  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const setSelectedSceneId = useStudioStore((s) => s.setSelectedSceneId);
  const getSceneConfig = useStudioStore((s) => s.getSceneConfig);
  const setSceneConfig = useStudioStore((s) => s.setSceneConfig);

  useEffect(() => {
    setSelectedProjectId(params.projectId);
    setSelectedSceneId(params.sceneId);
  }, [params.projectId, params.sceneId, setSelectedProjectId, setSelectedSceneId]);

  const config = getSceneConfig(params.projectId, params.sceneId);

  const title = useMemo(() => sceneMeta?.title || config.title, [sceneMeta?.title, config.title]);
  const episode = useMemo(() => sceneMeta?.episodeLabel || config.episodeLabel, [sceneMeta?.episodeLabel, config.episodeLabel]);

  if (!project) return <div className="text-[13px] font-semibold text-white/60">프로젝트를 찾을 수 없어요.</div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">
            씬 편집 <span className="text-white/35">({episode})</span>
          </div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">
            {project.title} · <span className="text-white/70">{title}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
            onClick={() => alert("임시저장(더미)")}
          >
            임시저장
          </button>
          <button
            type="button"
            className="rounded-lg bg-[#4F7CFF] px-3 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF]"
            onClick={() => alert("배포하기(더미)")}
          >
            배포하기
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
        <Tabs.Root defaultValue="cast" className="w-full">
          <Tabs.List className="flex items-center gap-2 border-b border-white/10 px-4 pt-3">
            {[
              { v: "cast", label: "참여 캐릭터/그룹챗" },
              { v: "lorebook", label: "씬 로어북" },
              { v: "rules", label: "씬 룰(트리거)" },
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

          <Tabs.Content value="cast" className="p-5">
            <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
              <div>
                <div className="text-[13px] font-extrabold text-white/80">그룹챗(씬) 설정</div>
                <div className="mt-2 text-[12px] font-semibold text-white/40">
                  드라마형은 씬별 진행이 기본이고, 씬 안에서 여러 캐릭터가 등장(그룹챗)할 수 있어요.
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-extrabold text-white/70">그룹챗 사용</div>
                    <button
                      type="button"
                      className={cn(
                        "h-7 w-12 rounded-full border border-white/10 p-1",
                        config.groupChatEnabled ? "bg-[#4F7CFF]" : "bg-white/[0.06]"
                      )}
                      onClick={() =>
                        setSceneConfig(params.projectId, params.sceneId, { ...config, groupChatEnabled: !config.groupChatEnabled })
                      }
                    >
                      <div className={cn("h-5 w-5 rounded-full bg-white transition-transform", config.groupChatEnabled ? "translate-x-5" : "")} />
                    </button>
                  </div>

                  <div className="mt-4 text-[12px] font-extrabold text-white/60">참여 캐릭터</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {cast.map((c) => {
                      const checked = config.participantIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={cn(
                            "flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3",
                            checked ? "ring-1 ring-[#4F7CFF]/40" : ""
                          )}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-extrabold text-white/80">{c.name}</div>
                            <div className="mt-1 text-[11px] font-semibold text-white/40">{c.roleLabel}</div>
                          </div>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#4F7CFF]"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              const next = on
                                ? Array.from(new Set([...config.participantIds, c.id]))
                                : config.participantIds.filter((x) => x !== c.id);
                              setSceneConfig(params.projectId, params.sceneId, { ...config, participantIds: next });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-3 text-[11px] font-semibold text-white/35">
                    Tip: 1:1 대화는 참여 캐릭터 중 1명을 선택해 진행하고, 그룹챗은 참여 캐릭터가 동시에 등장하는 씬에서 사용합니다.
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="text-[13px] font-extrabold text-white/80">합성 정책(미리보기)</div>
                <div className="mt-2 text-[12px] font-semibold text-white/45">
                  기본 우선순위: <span className="text-white/70">Scene &gt; Character &gt; Project</span>
                </div>
                <div className="mt-4 space-y-2 text-[12px] font-semibold text-white/55">
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    - Scene: 이번 회차 사건/제약(강제력이 가장 큼)
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    - Character: 개인 비밀/관점/관계(입체감 담당)
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    - Project: 세계관 공통 규칙/상식(기반 안정성)
                  </div>
                </div>
                <div className="mt-4 text-[11px] font-semibold text-white/35">
                  권장: 기본은 <span className="text-white/60">덮어쓰기(override)</span>, 특정 키만 <span className="text-white/60">합치기(append)</span> 허용.
                </div>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="lorebook" className="p-5">
            <LorebookManager
              title="씬 로어북"
              subtitle="이번 씬에서만 유효한 사건/상태/정보를 관리합니다. (mergeMode로 override/append 지정)"
              listId={`scene-sku-${params.projectId}-${params.sceneId}`}
              rows={config.lorebook}
              onChange={(next) => setSceneConfig(params.projectId, params.sceneId, { ...config, lorebook: next })}
              showMergeMode
            />
          </Tabs.Content>

          <Tabs.Content value="rules" className="p-5">
            <TriggerRuleBuilder
              title="씬 룰(트리거)"
              subtitle="씬에서만 적용되는 IF-THEN 규칙입니다."
              value={config.rules}
              onChange={(next) => setSceneConfig(params.projectId, params.sceneId, { ...config, rules: next })}
            />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}

