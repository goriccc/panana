"use client";

import { useEffect, useMemo, useState } from "react";
import { parseStudioMarkdownImport } from "@/lib/studio/importMarkdown";
import {
  studioCreateCharacter,
  studioCreateProject,
  studioEnsureProjectScenesFromImport,
  studioGetCharacter,
  studioListCharacters,
  studioListProjects,
  studioUpdateCharacterPublicProfile,
  studioSaveLorebook,
  studioSaveProjectLorebook,
  studioSaveProjectRules,
  studioUpgradeTriggerRules,
  studioUpgradeAllTriggerRules,
  studioSavePromptPayload,
  studioSaveTriggers,
  studioUpdateCharacterRoleLabel,
} from "@/lib/studio/db";
import type { StudioCharacterRow } from "@/lib/studio/db";
import Link from "next/link";
import { StudioSelect } from "@/app/studio/_components/StudioSelect";
import { StudioConfirmDialog } from "@/app/studio/_components/StudioDialogs";
import { useStudioStore } from "@/lib/studio/store";

function Dropzone({ onPick }: { onPick: (file: File) => void }) {
  return (
    <label
      className="block cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/15 p-4 hover:bg-black/20"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
    >
      <input
        type="file"
        accept=".md,text/markdown,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
      <div className="text-[12px] font-extrabold text-white/70">마크다운 파일 드래그앤드롭 또는 클릭 업로드</div>
      <div className="mt-1 text-[11px] font-semibold text-white/35">Gemini 결과를 그대로 넣고, 자동 파싱 → 미리보기 → 적용</div>
    </label>
  );
}

function slugifyAscii(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function extractParenEnglish(s: string) {
  // "윤세아 (Yoon Se-ah)" -> "Yoon Se-ah"
  const m = /\(([^)]+)\)/.exec(s);
  if (!m) return "";
  const v = String(m[1] || "").trim();
  return /[a-z]/i.test(v) ? v : "";
}

function parseImportMeta(md: string): {
  projectTitle: string;
  projectSlugHint: string;
  characterName: string;
  characterSlugHint: string;
  roleLabel: string;
} {
  const text = md || "";

  // 프로젝트: [프로젝트: 얼음성 (The Ice Castle)]
  let projectTitle = "";
  const mProj = /\[프로젝트\s*:\s*([^\]\n]+)\]/i.exec(text);
  if (mProj?.[1]) projectTitle = String(mProj[1]).trim();
  if (!projectTitle) {
    const mProj2 = /프로젝트\s*:\s*([^\n]+)/i.exec(text);
    if (mProj2?.[1]) projectTitle = String(mProj2[1]).trim();
  }

  // 메인 캐릭터: 윤세아 (Yoon Se-ah)
  // 메인 캐릭터명: 차은경 (Cha Eun-kyung)
  let characterName = "";
  const mChar =
    /(?:^|\n)\s*(?:[•\u2022\-\*]\s*)?메인\s*캐릭터명?\s*[:：]\s*([^\n]+)/i.exec(text) ||
    /(?:^|\n)\s*(?:[•\u2022\-\*]\s*)?메인\s*캐릭터\s*[:：]\s*([^\n]+)/i.exec(text) ||
    /메인\s*캐릭터명?\s*[:：]\s*([^\n]+)/i.exec(text) ||
    /메인\s*캐릭터\s*[:：]\s*([^\n]+)/i.exec(text);
  if (mChar?.[1]) characterName = String(mChar[1]).trim();
  if (!characterName) {
    const mChar2 = /메인\s*캐릭터명?\s*[:：]\s*([^\n]+)/i.exec(text);
    if (mChar2?.[1]) characterName = String(mChar2[1]).trim();
  }

  // 역할(role_label): 여주/권력자
  let roleLabel = "";
  const mRole =
    /(?:^|\n)\s*(?:[•\u2022\-\*]\s*)?역할\s*(?:\(\s*role_label\s*\))?\s*[:：]\s*([^\n]+)/i.exec(text) ||
    /역할\s*(?:\(\s*role_label\s*\))?\s*[:：]\s*([^\n]+)/i.exec(text);
  if (mRole?.[1]) roleLabel = String(mRole[1]).trim();

  const projectSlugHint = slugifyAscii(extractParenEnglish(projectTitle) || projectTitle) || "new-project";
  const characterSlugHint = slugifyAscii(extractParenEnglish(characterName) || characterName) || "main-character";

  return {
    projectTitle: projectTitle || "새 프로젝트",
    projectSlugHint,
    characterName: characterName || "새 캐릭터",
    characterSlugHint,
    roleLabel: roleLabel || "",
  };
}

function makeUniqueSlug(base: string, used: Set<string>, fallback: string) {
  const s = (base || "").trim() || fallback;
  if (!used.has(s)) return s;
  for (let i = 2; i <= 50; i++) {
    const suffix = `-${i}`;
    const trimmed = s.length + suffix.length <= 64 ? s : s.slice(0, Math.max(1, 64 - suffix.length));
    const candidate = `${trimmed}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${s.slice(0, 50)}-${Date.now().toString().slice(-6)}`;
}

export function StudioImportClient() {
  const [md, setMd] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [chars, setChars] = useState<StudioCharacterRow[]>([]);
  const [targetCharacterId, setTargetCharacterId] = useState<string>("");
  const selectedProjectId = useStudioStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);

  const [applyPrompt, setApplyPrompt] = useState(true);
  const [applyLorebook, setApplyLorebook] = useState(true);
  const [applyTriggers, setApplyTriggers] = useState(false);
  const [applyProjectLorebook, setApplyProjectLorebook] = useState(true);
  const [applyProjectRules, setApplyProjectRules] = useState(true);
  const [applyScenes, setApplyScenes] = useState(true);
  const [promptTouched, setPromptTouched] = useState(false);
  const [lorebookTouched, setLorebookTouched] = useState(false);
  const [projectLorebookTouched, setProjectLorebookTouched] = useState(false);
  const [projectRulesTouched, setProjectRulesTouched] = useState(false);
  const [scenesTouched, setScenesTouched] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeAllOpen, setUpgradeAllOpen] = useState(false);
  const [upgradeAllBusy, setUpgradeAllBusy] = useState(false);

  const reloadProjects = async () => {
    const list = await studioListProjects();
    setProjects(list.map((p) => ({ id: p.id, title: p.title, slug: p.slug })));
    // 프로젝트 선택이 비어있고(또는 유효하지 않고) 프로젝트가 있으면 첫 번째로 맞춘다.
    if (!selectedProjectId && list[0]?.id) setSelectedProjectId(list[0].id);
    if (selectedProjectId && !list.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(list[0]?.id || null);
    }
  };

  const reloadChars = async (projectId?: string | null) => {
    const list = await studioListCharacters(projectId ? { projectId } : undefined);
    setChars(list);
    // 선택된 캐릭터가 삭제되었다면 자동으로 첫 번째로 이동(또는 빈값)
    if (targetCharacterId && !list.some((c) => c.id === targetCharacterId)) {
      setTargetCharacterId(list[0]?.id || "");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const ps = await studioListProjects().catch(() => []);
        setProjects(ps.map((p) => ({ id: p.id, title: p.title, slug: p.slug })));
        // 최근 선택 프로젝트(localStorage/store)를 우선 사용, 없으면 첫 프로젝트
        const nextProjId =
          (selectedProjectId && ps.some((p) => p.id === selectedProjectId) ? selectedProjectId : null) ||
          ps[0]?.id ||
          null;
        if (nextProjId && nextProjId !== selectedProjectId) setSelectedProjectId(nextProjId);

        const list = await studioListCharacters(nextProjId ? { projectId: nextProjId } : undefined);
        setChars(list);
        // 최근 선택 캐릭터(localStorage)를 우선 사용하고, 없으면 첫 번째 캐릭터로 자동 선택
        let preferred: string | null = null;
        try {
          if (typeof window !== "undefined") preferred = window.localStorage.getItem("studio_selected_character_id");
        } catch {}
        const nextId =
          (preferred && list.some((c) => c.id === preferred) ? preferred : null) ||
          (targetCharacterId && list.some((c) => c.id === targetCharacterId) ? targetCharacterId : null) ||
          list[0]?.id ||
          "";
        if (nextId && nextId !== targetCharacterId) setTargetCharacterId(nextId);
        if (!list.length) {
          setTargetCharacterId("");
        }
      } catch (e: any) {
        setErr(e?.message || "캐릭터 목록을 불러오지 못했어요.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 프로젝트 변경 시 캐릭터 목록을 해당 프로젝트로 필터링
    (async () => {
      try {
        await reloadChars(selectedProjectId);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const parsed = useMemo(() => parseStudioMarkdownImport(md), [md]);
  const meta = useMemo(() => parseImportMeta(md), [md]);
  const publicProfile = parsed.publicProfile;
  const warnings = parsed.warnings || [];
  const canApplyTriggers = Boolean(parsed.triggers);
  const hasPromptPatch = Boolean(parsed.promptPatch);
  const hasLorebook = Boolean(parsed.lorebook && parsed.lorebook.length);
  const hasProjectLorebook = Boolean(parsed.projectLorebook && parsed.projectLorebook.length);
  const hasProjectRules = Boolean(parsed.projectRules && parsed.projectRules.rules && parsed.projectRules.rules.length);
  const hasScenes = Boolean(parsed.projectScenes && parsed.projectScenes.length);
  const hasAnyPayload = Boolean(hasPromptPatch || hasLorebook || canApplyTriggers);
  const hasAnyProjectPayload = Boolean(hasProjectLorebook || hasProjectRules || hasScenes);

  useEffect(() => {
    // 트리거가 감지되면 기본 ON(완전 자동 플로우)
    if (canApplyTriggers) setApplyTriggers(true);
    else setApplyTriggers(false);
  }, [canApplyTriggers]);

  useEffect(() => {
    // 파싱 결과가 없는 항목은 자동으로 OFF(실수로 빈 데이터를 덮어쓰는 것 방지)
    // 단, 사용자가 수동으로 토글한 경우(touched)는 존중
    if (!promptTouched) {
      if (!hasPromptPatch) setApplyPrompt(false);
      else setApplyPrompt(true);
    }
    if (!lorebookTouched) {
      if (!hasLorebook) setApplyLorebook(false);
      else setApplyLorebook(true);
    }
    if (!projectLorebookTouched) {
      if (!hasProjectLorebook) setApplyProjectLorebook(false);
      else setApplyProjectLorebook(true);
    }
    if (!projectRulesTouched) {
      if (!hasProjectRules) setApplyProjectRules(false);
      else setApplyProjectRules(true);
    }
    if (!scenesTouched) {
      if (!hasScenes) setApplyScenes(false);
      else setApplyScenes(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasPromptPatch,
    hasLorebook,
    hasProjectLorebook,
    hasProjectRules,
    hasScenes,
    promptTouched,
    lorebookTouched,
    projectLorebookTouched,
    projectRulesTouched,
    scenesTouched,
  ]);

  return (
    <div>
      <div className="mb-4">
        <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">Import (마크다운)</div>
        <div className="mt-1 text-[12px] font-semibold text-white/40">Gemini가 생성한 결과를 마크다운으로 넣으면, Studio DB에 적용합니다.</div>
      </div>

      {err ? <div className="mb-3 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
      {okMsg ? <div className="mb-3 text-[12px] font-semibold text-[#6ee7b7]">{okMsg}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
        <div className="space-y-3">
          <Dropzone
            onPick={async (file) => {
              setErr(null);
              setOkMsg(null);
              const text = await file.text();
              setMd(text);
            }}
          />
          <textarea
            value={md}
            onChange={(e) => {
              setOkMsg(null);
              setMd(e.target.value);
            }}
            placeholder="여기에 Gemini 결과 마크다운을 붙여넣으세요..."
            rows={22}
            className="studio-scrollbar w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-[12px] font-semibold text-white/80 outline-none placeholder:text-white/25"
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[13px] font-extrabold text-white/80">적용 대상</div>
          <div className="mt-3">
            <div className="text-[12px] font-bold text-white/55">프로젝트</div>
            <StudioSelect
              value={selectedProjectId || ""}
              onChange={(next) => {
                setSelectedProjectId(next || null);
              }}
              placeholder="프로젝트를 선택하세요"
              options={[
                { value: "", label: "전체 프로젝트(필터 없음)" },
                ...projects.map((p) => ({ value: p.id, label: `${p.title} (${p.slug})` })),
              ]}
              disabled={!projects.length}
              allowClear
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-white/35">새 프로젝트가 필요하면 여기서 바로 만들 수 있어요.</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-white/[0.06] px-3 py-2 text-[11px] font-extrabold text-white/70 ring-1 ring-white/10 hover:bg-white/[0.08]"
                  onClick={async () => {
                    setErr(null);
                    try {
                      await reloadProjects();
                    } catch (e: any) {
                      setErr(e?.message || "프로젝트 새로고침에 실패했어요.");
                    }
                  }}
                >
                  프로젝트 새로고침
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#4F7CFF]/15 px-3 py-2 text-[11px] font-extrabold text-[#8FB1FF] hover:bg-[#4F7CFF]/20 disabled:opacity-50"
                  disabled={!md.trim()}
                  onClick={async () => {
                    setErr(null);
                    setOkMsg(null);
                    try {
                      const ps = await studioListProjects();
                      const used = new Set(ps.map((p) => String(p.slug || "").toLowerCase()).filter(Boolean));
                      const nextSlug = makeUniqueSlug(meta.projectSlugHint, used, "new-project");
                      const created = await studioCreateProject({ title: meta.projectTitle, slug: nextSlug });
                      setProjects([{ id: created.id, title: created.title, slug: created.slug }, ...projects]);
                      setSelectedProjectId(created.id);
                      setOkMsg(`프로젝트 생성 완료: ${created.title}`);
                    } catch (e: any) {
                      setErr(e?.message || "프로젝트 생성에 실패했어요. (로그인/RLS 확인)");
                    }
                  }}
                >
                  이 마크다운으로 새 프로젝트 생성
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[12px] font-bold text-white/55">캐릭터</div>
            <StudioSelect
              value={targetCharacterId}
              onChange={(next) => {
                setTargetCharacterId(next);
                // 사용자가 "선택 해제"를 누르면 최근 선택 캐릭터 고정도 같이 해제
                if (!next) {
                  try {
                    window.localStorage.removeItem("studio_selected_character_id");
                  } catch {}
                }
              }}
              placeholder="캐릭터를 선택하세요"
              options={[
                { value: "", label: "선택 해제(없음)" },
                ...chars.map((c) => ({ value: c.id, label: `${c.name} (${c.slug})` })),
              ]}
              disabled={!chars.length}
              allowClear
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[11px] font-semibold text-white/35">Tip: 다른 화면에서 캐릭터 삭제/생성했으면 새로고침하세요.</div>
              <button
                type="button"
                className="rounded-lg bg-white/[0.06] px-3 py-2 text-[11px] font-extrabold text-white/70 ring-1 ring-white/10 hover:bg-white/[0.08]"
                onClick={async () => {
                  setErr(null);
                  try {
                    await reloadChars(selectedProjectId);
                  } catch (e: any) {
                    setErr(e?.message || "새로고침에 실패했어요.");
                  }
                }}
              >
                목록 새로고침
              </button>
            </div>
            {!chars.length ? (
              <div className="mt-2 text-[11px] font-semibold text-[#ff9aa1]">
                적용할 캐릭터가 없어요. 먼저 <Link href="/studio/projects" className="underline text-white/70">프로젝트에서 캐스트(캐릭터)를 생성</Link>하세요.
                <div className="mt-2">
                  <button
                    type="button"
                    className="rounded-lg bg-[#4F7CFF]/15 px-3 py-2 text-[11px] font-extrabold text-[#8FB1FF] hover:bg-[#4F7CFF]/20 disabled:opacity-50"
                    disabled={!md.trim()}
                    onClick={() => setAutoOpen(true)}
                  >
                    이 마크다운으로 프로젝트+메인 캐릭터 자동 생성
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 space-y-2">
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 py-3">
              <div>
                <div className="text-[12px] font-extrabold text-white/75">시스템 프롬프트 / Few-shot / 오서노트</div>
                <div className="mt-1 text-[11px] font-semibold text-white/35">DB: character_prompts.payload</div>
              </div>
              <input
                type="checkbox"
                checked={applyPrompt}
                onChange={(e) => {
                  setPromptTouched(true);
                  setApplyPrompt(e.target.checked);
                }}
                className="h-4 w-4 accent-[#4F7CFF]"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 py-3">
              <div>
                <div className="text-[12px] font-extrabold text-white/75">로어북</div>
                <div className="mt-1 text-[11px] font-semibold text-white/35">DB: lorebook_entries(character scope) — 전체 교체</div>
              </div>
              <input
                type="checkbox"
                checked={applyLorebook}
                onChange={(e) => {
                  setLorebookTouched(true);
                  setApplyLorebook(e.target.checked);
                }}
                className="h-4 w-4 accent-[#4F7CFF]"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 py-3">
              <div>
                <div className="text-[12px] font-extrabold text-white/75">변수 트리거</div>
                <div className="mt-1 text-[11px] font-semibold text-white/35">IF/THEN 자동 추출 지원</div>
              </div>
              <input
                type="checkbox"
                checked={applyTriggers}
                disabled={!canApplyTriggers}
                onChange={(e) => setApplyTriggers(e.target.checked)}
                className="h-4 w-4 accent-[#4F7CFF] disabled:opacity-40"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 py-3">
              <div>
                <div className="text-[12px] font-extrabold text-white/75">프로젝트 로어북(H)</div>
                <div className="mt-1 text-[11px] font-semibold text-white/35">DB: lorebook_entries(project scope) — 전체 교체</div>
              </div>
              <input
                type="checkbox"
                checked={applyProjectLorebook}
                disabled={!hasProjectLorebook}
                onChange={(e) => {
                  setProjectLorebookTouched(true);
                  setApplyProjectLorebook(e.target.checked);
                }}
                className="h-4 w-4 accent-[#4F7CFF] disabled:opacity-40"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 py-3">
              <div>
                <div className="text-[12px] font-extrabold text-white/75">프로젝트 룰(I)</div>
                <div className="mt-1 text-[11px] font-semibold text-white/35">DB: trigger_rule_sets(project scope)</div>
              </div>
              <input
                type="checkbox"
                checked={applyProjectRules}
                disabled={!hasProjectRules}
                onChange={(e) => {
                  setProjectRulesTouched(true);
                  setApplyProjectRules(e.target.checked);
                }}
                className="h-4 w-4 accent-[#4F7CFF] disabled:opacity-40"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 py-3">
              <div>
                <div className="text-[12px] font-extrabold text-white/75">씬(드라마)</div>
                <div className="mt-1 text-[11px] font-semibold text-white/35">DB: scenes (project scope) — 없으면 자동 생성</div>
              </div>
              <input
                type="checkbox"
                checked={applyScenes}
                disabled={!hasScenes}
                onChange={(e) => {
                  setScenesTouched(true);
                  setApplyScenes(e.target.checked);
                }}
                className="h-4 w-4 accent-[#4F7CFF] disabled:opacity-40"
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
            <div className="text-[12px] font-extrabold text-white/80">레거시 룰 업그레이드</div>
            <div className="mt-1 text-[11px] font-semibold text-white/40">
              재임포트 없이 기존 룰을 새 엔진에 맞게 자동 보정합니다. (join/leave, 변수 비교, location/time, participant)
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-xl bg-white/[0.06] px-4 py-3 text-[12px] font-extrabold text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08] disabled:opacity-50"
                disabled={!selectedProjectId}
                onClick={() => setUpgradeOpen(true)}
              >
                현재 프로젝트 룰 업그레이드
              </button>
              <button
                type="button"
                className="rounded-xl bg-[#4F7CFF]/15 px-4 py-3 text-[12px] font-extrabold text-[#8FB1FF] ring-1 ring-white/10 hover:bg-[#4F7CFF]/20"
                onClick={() => setUpgradeAllOpen(true)}
              >
                전체 프로젝트 룰 업그레이드
              </button>
              {!selectedProjectId ? (
                <div className="text-[11px] font-semibold text-white/35">프로젝트를 선택해야 실행할 수 있어요.</div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
            <div className="text-[12px] font-extrabold text-white/65">파싱 미리보기</div>
            <div className="mt-3 space-y-2 text-[12px] font-semibold text-white/70">
              <div>Few-shot: <span className="text-white/85">{parsed.promptPatch?.system?.fewShotPairs?.length || 0}</span> 쌍</div>
              <div>로어북: <span className="text-white/85">{parsed.lorebook?.length || 0}</span>개</div>
              <div>
                트리거:{" "}
                <span className="text-white/85">
                  {parsed.triggers?.rules?.length != null ? `${parsed.triggers.rules.length}개` : "없음"}
                </span>
              </div>
              <div>
                프로젝트 로어북(H): <span className="text-white/85">{parsed.projectLorebook?.length || 0}</span>개
              </div>
              <div>
                프로젝트 룰(I):{" "}
                <span className="text-white/85">
                  {parsed.projectRules?.rules?.length != null ? `${parsed.projectRules.rules.length}개` : "없음"}
                </span>
              </div>
              <div>
                씬(드라마): <span className="text-white/85">{parsed.projectScenes?.length || 0}</span>개
              </div>
              <div>
                오서노트: <span className="text-white/85">{parsed.promptPatch?.author?.authorNote ? `${parsed.promptPatch.author.authorNote.length}자` : "0자"}</span>
              </div>
              <div>
                운영자 메모:{" "}
                <span className="text-white/85">
                  {(parsed.promptPatch as any)?.meta?.operatorMemo ? `${String((parsed.promptPatch as any).meta.operatorMemo).length}자` : "0자"}
                </span>
              </div>
            </div>
            {warnings.length ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-[11px] font-extrabold text-white/55">경고</div>
                <ul className="mt-2 list-disc pl-5 text-[11px] font-semibold text-white/40">
                  {warnings.slice(0, 6).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl bg-[#4F7CFF] px-4 py-3 text-[13px] font-extrabold text-white hover:bg-[#3E6BFF] disabled:opacity-50"
              disabled={
                !md.trim() ||
                !targetCharacterId ||
                loading ||
                (!hasAnyPayload && !hasAnyProjectPayload) ||
                (!applyPrompt && !applyLorebook && !applyTriggers && !applyProjectLorebook && !applyProjectRules && !applyScenes)
              }
              onClick={async () => {
                setErr(null);
                setOkMsg(null);
                setLoading(true);
                try {
                  const c = await studioGetCharacter(targetCharacterId);
                  if (!c) throw new Error("캐릭터를 찾을 수 없어요.");

                  // 마크다운에서 역할(role_label)이 있고, 현재 캐릭터 role_label이 비어있으면 자동 채움(덮어쓰진 않음)
                  const nextRole = meta.roleLabel.trim();
                  if (nextRole && !String(c.role_label || "").trim()) {
                    await studioUpdateCharacterRoleLabel({ characterId: targetCharacterId, roleLabel: nextRole });
                  }

                  if (applyPrompt && parsed.promptPatch) {
                    await studioSavePromptPayload({
                      projectId: c.project_id,
                      characterId: targetCharacterId,
                      payload: parsed.promptPatch,
                      status: "draft",
                    });
                  }
                  if (applyLorebook && parsed.lorebook) {
                    await studioSaveLorebook(targetCharacterId, parsed.lorebook);
                  }
                  if (applyTriggers && parsed.triggers) {
                    await studioSaveTriggers(targetCharacterId, parsed.triggers);
                  }
                  if (applyProjectLorebook && parsed.projectLorebook) {
                    await studioSaveProjectLorebook(c.project_id, parsed.projectLorebook);
                  }
                  if (applyProjectRules && parsed.projectRules) {
                    await studioSaveProjectRules(c.project_id, parsed.projectRules);
                  }
                  if (applyScenes && parsed.projectScenes && parsed.projectScenes.length) {
                    await studioEnsureProjectScenesFromImport({
                      projectId: c.project_id,
                      scenes: parsed.projectScenes,
                      defaultParticipantIds: [targetCharacterId],
                    });
                  }

                  if (publicProfile) {
                    // Studio 캐릭터 공개 프로필 메타 저장: "비어있는 필드만" 채움(덮어쓰기 금지)
                    const patch: any = {};
                    if (!String(c.handle || "").trim() && publicProfile.handle) patch.handle = publicProfile.handle;
                    if ((!Array.isArray(c.hashtags) || !c.hashtags.length) && publicProfile.hashtags?.length) patch.hashtags = publicProfile.hashtags;
                    if (!String(c.tagline || "").trim() && publicProfile.tagline) patch.tagline = publicProfile.tagline;
                    if (!String(c.intro_title || "").trim() && publicProfile.introTitle) patch.intro_title = publicProfile.introTitle;
                    if ((!Array.isArray(c.intro_lines) || !c.intro_lines.length) && publicProfile.introLines?.length) patch.intro_lines = publicProfile.introLines;
                    if (!String(c.mood_title || "").trim() && publicProfile.moodTitle) patch.mood_title = publicProfile.moodTitle;
                    if ((!Array.isArray(c.mood_lines) || !c.mood_lines.length) && publicProfile.moodLines?.length) patch.mood_lines = publicProfile.moodLines;
                    if (Object.keys(patch).length) {
                      await studioUpdateCharacterPublicProfile({ characterId: targetCharacterId, patch });
                    }
                  }

                  setOkMsg("적용 완료! 해당 캐릭터 편집 화면에서 확인해보세요.");
                } catch (e: any) {
                  setErr(e?.message || "적용에 실패했어요.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "적용 중..." : "DB에 적용"}
            </button>
          </div>

          <div className="mt-3 text-[11px] font-semibold text-white/35">
            Tip: 로어북은 <span className="text-white/55">표( | )</span> 또는{" "}
            <span className="text-white/55">Text Format(1. key + Value/Unlock/Merge/Cost)</span> 둘 다 자동 지원합니다.
          </div>
        </div>
      </div>

      <StudioConfirmDialog
        open={upgradeOpen}
        title="레거시 룰을 업그레이드할까요?"
        description={`- 대상 프로젝트: ${projects.find((p) => p.id === selectedProjectId)?.title || "(선택 필요)"}\n- 적용 범위: 프로젝트/씬/캐릭터 룰 전체\n\n기존 룰을 유지하면서 자동 보정합니다.`}
        confirmText="업그레이드"
        cancelText="취소"
        busy={upgradeBusy}
        onClose={() => {
          if (upgradeBusy) return;
          setUpgradeOpen(false);
        }}
        onConfirm={async () => {
          if (!selectedProjectId) return;
          setErr(null);
          setOkMsg(null);
          setUpgradeBusy(true);
          try {
            const result = await studioUpgradeTriggerRules({ projectId: selectedProjectId });
            setOkMsg(`룰 업그레이드 완료: scanned=${result.scanned}, updated=${result.updated}`);
          } catch (e: any) {
            setErr(e?.message || "룰 업그레이드에 실패했어요.");
          } finally {
            setUpgradeBusy(false);
            setUpgradeOpen(false);
          }
        }}
      />

      <StudioConfirmDialog
        open={upgradeAllOpen}
        title="전체 프로젝트 룰을 업그레이드할까요?"
        description={`- 대상: 전체 프로젝트\n- 적용 범위: 프로젝트/씬/캐릭터 룰 전체\n\n기존 룰을 유지하면서 자동 보정합니다.`}
        confirmText="전체 업그레이드"
        cancelText="취소"
        busy={upgradeAllBusy}
        destructive
        onClose={() => {
          if (upgradeAllBusy) return;
          setUpgradeAllOpen(false);
        }}
        onConfirm={async () => {
          setErr(null);
          setOkMsg(null);
          setUpgradeAllBusy(true);
          try {
            const result = await studioUpgradeAllTriggerRules();
            setOkMsg(`전체 업그레이드 완료: projects=${result.projects}, scanned=${result.scanned}, updated=${result.updated}`);
          } catch (e: any) {
            setErr(e?.message || "전체 업그레이드에 실패했어요.");
          } finally {
            setUpgradeAllBusy(false);
            setUpgradeAllOpen(false);
          }
        }}
      />

      <StudioConfirmDialog
        open={autoOpen}
        title="프로젝트+메인 캐릭터를 자동 생성할까요?"
        description={`- 프로젝트: ${meta.projectTitle}\n- 캐릭터: ${meta.characterName}\n\n생성 후 자동으로 선택되어 DB 적용을 진행할 수 있어요.`}
        confirmText="생성"
        cancelText="취소"
        busy={autoBusy}
        onClose={() => {
          if (autoBusy) return;
          setAutoOpen(false);
        }}
        onConfirm={async () => {
          setErr(null);
          setOkMsg(null);
          setAutoBusy(true);
          try {
            // 1) 프로젝트 선택: 기존이 있으면 첫 번째, 없으면 새로 생성
            const projects = await studioListProjects();
            let projectId =
              (selectedProjectId && projects.some((p) => p.id === selectedProjectId) ? selectedProjectId : "") ||
              projects[0]?.id ||
              "";
            if (!projectId) {
              const usedProjectSlugs = new Set(projects.map((p) => String(p.slug || "").toLowerCase()).filter(Boolean));
              const nextProjSlug = makeUniqueSlug(meta.projectSlugHint, usedProjectSlugs, "new-project");
              const p = await studioCreateProject({ title: meta.projectTitle, slug: nextProjSlug });
              projectId = p.id;
            }

            // 2) 캐릭터 생성 (중복이면 suffix)
            const existingChars = await studioListCharacters({ projectId });
            const usedCharSlugs = new Set(existingChars.map((c) => String(c.slug || "").toLowerCase()).filter(Boolean));
            let nextCharSlug = makeUniqueSlug(meta.characterSlugHint, usedCharSlugs, "main-character");
            let created: StudioCharacterRow | null = null;
            for (let attempt = 0; attempt < 6; attempt++) {
              try {
                created = await studioCreateCharacter({
                  projectId,
                  name: meta.characterName,
                  slug: nextCharSlug,
                  roleLabel: meta.roleLabel || "",
                  handle: publicProfile?.handle,
                  hashtags: publicProfile?.hashtags,
                  tagline: publicProfile?.tagline,
                  introTitle: publicProfile?.introTitle,
                  introLines: publicProfile?.introLines,
                  moodTitle: publicProfile?.moodTitle,
                  moodLines: publicProfile?.moodLines,
                });
                break;
              } catch (e: any) {
                const msg = String(e?.message || "");
                const isDup = msg.includes("duplicate key value") || e?.code === "23505";
                if (!isDup) throw e;
                usedCharSlugs.add(nextCharSlug);
                nextCharSlug = makeUniqueSlug(nextCharSlug, usedCharSlugs, "main-character");
                if (attempt === 5) throw e;
              }
            }
            if (!created) throw new Error("캐릭터 생성에 실패했어요.");

            // 3) 목록 리로드 + 자동 선택
            const all = await studioListCharacters({ projectId });
            setChars(all);
            setTargetCharacterId(created.id);
            setSelectedProjectId(projectId);
            try {
              const ps = await studioListProjects();
              setProjects(ps.map((p) => ({ id: p.id, title: p.title, slug: p.slug })));
            } catch {}
            setAutoOpen(false);
            setOkMsg("프로젝트/캐릭터 생성 완료! 이제 DB에 적용을 누를 수 있어요.");
          } catch (e: any) {
            setErr(e?.message || "자동 생성에 실패했어요.");
          } finally {
            setAutoBusy(false);
          }
        }}
      />
    </div>
  );
}

