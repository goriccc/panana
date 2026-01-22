"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useMemo, useState } from "react";
import { useStudioStore } from "@/lib/studio/store";
import { cn } from "@/lib/utils/cn";
import { LorebookManager } from "@/app/studio/_components/LorebookManager";
import { TriggerRuleBuilder } from "@/app/studio/_components/TriggerRuleBuilder";
import {
  studioGetProject,
  studioGetScene,
  studioListCharacters,
  studioLoadSceneLorebook,
  studioLoadSceneParticipants,
  studioLoadSceneRules,
  studioLoadProjectRules,
  studioSaveSceneLorebook,
  studioSaveSceneParticipants,
  studioSaveSceneRules,
  studioUpdateSceneGroupChatEnabled,
} from "@/lib/studio/db";
import type { StudioCharacterRow, StudioProjectRow, StudioSceneRow } from "@/lib/studio/db";
import type { StudioLorebookItem, TriggerRulesPayload } from "@/lib/studio/types";

export default function SceneEditorPage({ params }: { params: { projectId: string; sceneId: string } }) {
  const [project, setProject] = useState<StudioProjectRow | null>(null);
  const [sceneMeta, setSceneMeta] = useState<StudioSceneRow | null>(null);
  const [cast, setCast] = useState<StudioCharacterRow[] | null>(null);
  const [projectRules, setProjectRules] = useState<TriggerRulesPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const setSelectedSceneId = useStudioStore((s) => s.setSelectedSceneId);

  // 씬별 설정은 DB(scope='scene')에서 로드/저장한다.
  const [groupChatEnabled, setGroupChatEnabled] = useState(true);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [lorebook, setLorebook] = useState<StudioLorebookItem[]>([]);
  const [rules, setRules] = useState<TriggerRulesPayload>({ rules: [] });

  useEffect(() => {
    setSelectedProjectId(params.projectId);
    setSelectedSceneId(params.sceneId);
    (async () => {
      try {
        setErr(null);
        setOkMsg(null);
        const [p, s, cs] = await Promise.all([
          studioGetProject(params.projectId),
          studioGetScene({ projectId: params.projectId, sceneId: params.sceneId }),
          studioListCharacters({ projectId: params.projectId }),
        ]);
        setProject(p);
        setSceneMeta(s);
        setCast(cs);
        if (!p) setErr("프로젝트를 찾을 수 없어요.");

        // DB에서 씬 scope 데이터 로드 (없으면 빈 값)
        const [dbLore, dbRules, dbParticipants, pRules] = await Promise.all([
          studioLoadSceneLorebook({ projectId: params.projectId, sceneId: params.sceneId }),
          studioLoadSceneRules({ projectId: params.projectId, sceneId: params.sceneId }),
          studioLoadSceneParticipants({ sceneId: params.sceneId }),
          studioLoadProjectRules(params.projectId).catch(() => null),
        ]);
        setLorebook((dbLore || []).map((r: any) => ({ ...r, mergeMode: (r as any).mergeMode || "override" })) as any);
        setRules((dbRules || { rules: [] }) as any);
        setParticipantIds(dbParticipants || []);
        setGroupChatEnabled(s?.group_chat_enabled ?? true);
        setProjectRules((pRules as any) || null);
      } catch (e: any) {
        setErr(e?.message || "불러오지 못했어요.");
        setProject(null);
        setSceneMeta(null);
        setCast(null);
      }
    })();
  }, [params.projectId, params.sceneId, setSelectedProjectId, setSelectedSceneId]);

  const title = useMemo(() => sceneMeta?.title || "씬", [sceneMeta?.title]);
  const episode = useMemo(() => sceneMeta?.episode_label || "EP", [sceneMeta?.episode_label]);

  const participantNameOptions = useMemo(() => {
    const map = new Map((cast || []).map((c) => [c.id, c.name] as const));
    return participantIds
      .map((id) => map.get(id))
      .filter((x): x is string => Boolean(x && String(x).trim()))
      .map((x) => String(x).trim());
  }, [cast, participantIds]);

  if (err) return <div className="text-[13px] font-semibold text-white/60">{err}</div>;
  if (!project || !cast) return <div className="text-[13px] font-semibold text-white/60">불러오는 중...</div>;

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
          {okMsg ? <div className="mt-2 text-[12px] font-semibold text-[#6ee7b7]">{okMsg}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
            disabled={busy}
            onClick={async () => {
              setErr(null);
              setOkMsg(null);
              setBusy(true);
              try {
                await studioUpdateSceneGroupChatEnabled({ projectId: params.projectId, sceneId: params.sceneId, groupChatEnabled });
                await studioSaveSceneParticipants({ sceneId: params.sceneId, participantIds });
                await studioSaveSceneLorebook({ projectId: params.projectId, sceneId: params.sceneId, rows: lorebook as any });
                await studioSaveSceneRules({ projectId: params.projectId, sceneId: params.sceneId, payload: rules });
                setOkMsg("저장 완료!");
              } catch (e: any) {
                setErr(e?.message || "저장에 실패했어요.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "저장 중..." : "저장"}
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
                        groupChatEnabled ? "bg-[#4F7CFF]" : "bg-white/[0.06]"
                      )}
                      onClick={() => setGroupChatEnabled((v) => !v)}
                    >
                      <div className={cn("h-5 w-5 rounded-full bg-white transition-transform", groupChatEnabled ? "translate-x-5" : "")} />
                    </button>
                  </div>

                  <div className="mt-4 text-[12px] font-extrabold text-white/60">참여 캐릭터</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {cast.map((c) => {
                      const checked = participantIds.includes(c.id);
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
                            <div className="mt-1 text-[11px] font-semibold text-white/40">{c.role_label}</div>
                          </div>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#4F7CFF]"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              const next = on
                                ? Array.from(new Set([...participantIds, c.id]))
                                : participantIds.filter((x) => x !== c.id);
                              setParticipantIds(next);
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
                  기본 우선순위: <span className="text-white/70">Character &gt; Scene &gt; Project</span>
                </div>
                <div className="mt-4 space-y-2 text-[12px] font-semibold text-white/55">
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    - Character: 개인 비밀/관점/관계(최우선)
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    - Scene: 이번 회차 사건/제약(상황 보정)
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    - Project: 세계관 공통 규칙/상식(기반)
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
              rows={lorebook}
              onChange={setLorebook}
              showMergeMode
            />
          </Tabs.Content>

          <Tabs.Content value="rules" className="p-5">
            <TriggerRuleBuilder
              title="씬 룰(트리거)"
              subtitle="씬에서만 적용되는 IF-THEN 규칙입니다."
              value={rules}
              onChange={setRules}
              nameSuggestions={participantNameOptions}
              labelScope="scene"
              contextVarLabels={{
                project: (projectRules as any)?.varLabels,
              }}
            />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}

