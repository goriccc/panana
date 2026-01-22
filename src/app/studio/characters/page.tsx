"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useStudioStore } from "@/lib/studio/store";
import {
  studioCreateCharacter,
  studioListCharacters,
  studioListProjects,
  studioPublishCharacter,
  studioUnpublishCharacter,
  type StudioCharacterRow,
  type StudioProjectRow,
} from "@/lib/studio/db";
import { StudioConfirmDialog, StudioFormDialog } from "@/app/studio/_components/StudioDialogs";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function makeUniqueSlug(base: string, used: Set<string>) {
  const raw = (base || "").trim();
  const s = raw ? raw : "new-character";
  if (!used.has(s)) return s;
  for (let i = 2; i <= 50; i++) {
    const suffix = `-${i}`;
    const trimmed = s.length + suffix.length <= 64 ? s : s.slice(0, Math.max(1, 64 - suffix.length));
    const candidate = `${trimmed}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${s.slice(0, 50)}-${Date.now().toString().slice(-6)}`;
}

function StatusPill({ status }: { status: "draft" | "published" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-extrabold",
        status === "published"
          ? "bg-[#22c55e]/15 text-[#6ee7b7]"
          : "bg-white/10 text-white/55"
      )}
    >
      {status === "published" ? "배포중" : "임시저장"}
    </span>
  );
}

export default function StudioCharactersPage() {
  const [q, setQ] = useState("");
  const selectedId = useStudioStore((s) => s.selectedCharacterId);
  const setSelectedId = useStudioStore((s) => s.setSelectedCharacterId);
  const selectedProjectId = useStudioStore((s) => s.selectedProjectId);
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);

  const [projects, setProjects] = useState<StudioProjectRow[] | null>(null);
  const [rows, setRows] = useState<StudioCharacterRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [deployId, setDeployId] = useState<string | null>(null);
  const [deployBusy, setDeployBusy] = useState(false);
  const [unpublishId, setUnpublishId] = useState<string | null>(null);
  const [unpublishBusy, setUnpublishBusy] = useState(false);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const [ps, cs] = await Promise.all([studioListProjects(), studioListCharacters(selectedProjectId ? { projectId: selectedProjectId } : undefined)]);
      setProjects(ps);
      setRows(cs);
      if (!selectedProjectId && ps[0]?.id) {
        // 첫 로딩 시 기본 프로젝트 선택(브레드크럼/생성 UX)
        setSelectedProjectId(ps[0].id);
      }
    } catch (e: any) {
      setErr(e?.message || "캐릭터를 불러오지 못했어요.");
      setRows(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 새로고침 후에도 마지막 선택을 복구 (헤더 브레드크럼 UX)
    try {
      const v = window.localStorage.getItem("studio_selected_character_id");
      if (v && !selectedId) setSelectedId(v);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const items = useMemo(() => {
    const v = q.trim().toLowerCase();
    const base = (rows || []).map((c) => ({
      id: c.id,
      name: c.name,
      genre: (projects?.find((p) => p.id === c.project_id)?.title || c.project_id) as string,
      status: c.status === "published" ? ("published" as const) : ("draft" as const),
      updatedAt: (c.updated_at || "").slice(0, 10) || "",
    }));
    if (!v) return base;
    return base.filter((c) => c.name.toLowerCase().includes(v) || c.genre.toLowerCase().includes(v));
  }, [q, rows, projects]);

  const usedSlugs = useMemo(() => new Set((rows || []).map((r) => String(r.slug || "").toLowerCase()).filter(Boolean)), [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">캐릭터 관리</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">
            캐릭터를 선택하면 프롬프트(3-Layer), 로어북, 변수 트리거를 편집할 수 있어요.
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#4F7CFF] px-4 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF]"
          onClick={async () => {
            setErr(null);
            const projectId = selectedProjectId || projects?.[0]?.id;
            if (!projectId) {
              setErr("프로젝트가 없어요. 먼저 프로젝트를 생성하세요.");
              return;
            }
            setNewName("");
            setNewSlug("");
            setSlugTouched(false);
            setCreateOpen(true);
          }}
        >
          + 새 캐릭터
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="text-[12px] font-semibold text-white/45">프로젝트:</div>
        <select
          value={selectedProjectId || ""}
          onChange={(e) => setSelectedProjectId(e.target.value || null)}
          className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
        >
          {(projects || []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
          {!projects?.length ? <option value="">(더미 모드)</option> : null}
        </select>
        {err ? <div className="text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
        {loading ? <div className="text-[12px] font-semibold text-white/45">불러오는 중...</div> : null}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="캐릭터 이름/장르 검색..."
          className="w-full bg-transparent text-[12px] font-semibold text-white/80 placeholder:text-white/25 outline-none"
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!items.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-[12px] font-semibold text-white/55">
            캐릭터가 없어요. 오른쪽 위의 <span className="text-white/75">+ 새 캐릭터</span>로 만들어주세요.
          </div>
        ) : null}
        {items.map((c) => (
          <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-extrabold text-white/85">{c.name}</div>
                <div className="mt-1 text-[12px] font-semibold text-white/40">{c.genre}</div>
              </div>
              <div className="flex items-center gap-2">
                {c.status !== "published" ? (
                  <button
                    type="button"
                    className="rounded-full bg-[#4F7CFF]/15 px-2 py-1 text-[11px] font-extrabold text-[#8FB1FF] hover:bg-[#4F7CFF]/20"
                    onClick={() => setDeployId(c.id)}
                  >
                    배포하기
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-full bg-[#ff3d4a]/15 px-2 py-1 text-[11px] font-extrabold text-[#ff9aa1] hover:bg-[#ff3d4a]/20"
                    onClick={() => setUnpublishId(c.id)}
                  >
                    배포중지
                  </button>
                )}
                <StatusPill status={c.status} />
              </div>
            </div>

            <div className="mt-4 text-[11px] font-semibold text-white/35">
              최근 수정: <span className="text-white/55">{c.updatedAt}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href={`/studio/characters/${c.id}/prompt`}
                onClick={() => setSelectedId(c.id)}
                className="rounded-xl bg-white/[0.06] px-3 py-3 text-center text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
              >
                프롬프트
              </Link>
              <Link
                href={`/studio/characters/${c.id}/triggers`}
                onClick={() => setSelectedId(c.id)}
                className="rounded-xl bg-white/[0.03] px-3 py-3 text-center text-[12px] font-extrabold text-white/70 ring-1 ring-white/10 hover:bg-white/[0.05]"
              >
                변수 트리거
              </Link>
            </div>

            <div className="mt-2">
              <Link
                href={`/studio/characters/${c.id}/prompt?tab=lorebook`}
                onClick={() => setSelectedId(c.id)}
                className="block rounded-xl bg-white/[0.02] px-3 py-3 text-center text-[12px] font-extrabold text-white/60 ring-1 ring-white/10 hover:bg-white/[0.04]"
              >
                로어북
              </Link>
            </div>
          </div>
        ))}
      </div>

      <StudioConfirmDialog
        open={Boolean(deployId)}
        title="이 캐릭터를 배포할까요?"
        description={"배포하면 앱/채팅에서 published 버전으로 읽히기 시작합니다.\n(초안 편집은 계속 가능)"}
        confirmText="배포하기"
        cancelText="취소"
        busy={deployBusy}
        onClose={() => {
          if (deployBusy) return;
          setDeployId(null);
        }}
        onConfirm={async () => {
          if (!deployId) return;
          setErr(null);
          setDeployBusy(true);
          try {
            await studioPublishCharacter(deployId);
            setDeployId(null);
            await load();
          } catch (e: any) {
            setErr(e?.message || "배포에 실패했어요.");
          } finally {
            setDeployBusy(false);
          }
        }}
      />

      <StudioConfirmDialog
        open={Boolean(unpublishId)}
        title="배포중지할까요?"
        description={"배포중지하면 앱/채팅에서 더 이상 노출되지 않습니다.\n(Studio에서 계속 편집 가능)"}
        confirmText="배포중지"
        cancelText="취소"
        busy={unpublishBusy}
        onClose={() => {
          if (unpublishBusy) return;
          setUnpublishId(null);
        }}
        onConfirm={async () => {
          if (!unpublishId) return;
          setErr(null);
          setUnpublishBusy(true);
          try {
            await studioUnpublishCharacter(unpublishId);
            setUnpublishId(null);
            await load();
          } catch (e: any) {
            setErr(e?.message || "배포중지에 실패했어요.");
          } finally {
            setUnpublishBusy(false);
          }
        }}
      />

      <StudioFormDialog
        open={createOpen}
        title="새 캐릭터 만들기"
        description="캐릭터 이름과 slug를 입력하세요."
        submitText="생성"
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onSubmit={async () => {
          const projectId = selectedProjectId || projects?.[0]?.id;
          if (!projectId) {
            setErr("프로젝트가 없어요. 먼저 프로젝트를 생성하세요.");
            return;
          }
          const name = newName.trim();
          if (!name) {
            setErr("캐릭터 이름을 입력하세요.");
            return;
          }
          const base = slugify(newSlug.trim() || slugify(name) || "new-character") || "new-character";
          let nextSlug = makeUniqueSlug(base, new Set(Array.from(usedSlugs)));
          setBusy(true);
          setErr(null);
          try {
            let created: StudioCharacterRow | null = null;
            const used = new Set(Array.from(usedSlugs));
            for (let attempt = 0; attempt < 6; attempt++) {
              try {
                created = await studioCreateCharacter({ projectId, name, slug: nextSlug });
                break;
              } catch (e: any) {
                const msg = String(e?.message || "");
                const isDup =
                  msg.includes("duplicate key value") ||
                  msg.includes("characters_project_id_slug_key") ||
                  msg.includes("unique(project_id, slug)") ||
                  e?.code === "23505";
                if (!isDup) throw e;
                used.add(nextSlug);
                nextSlug = makeUniqueSlug(nextSlug, used);
                if (attempt === 5) throw e;
              }
            }
            if (!created) throw new Error("생성에 실패했어요.");
            setCreateOpen(false);
            await load();
            setSelectedId(created.id);
          } catch (e: any) {
            setErr(e?.message || "생성에 실패했어요.");
          } finally {
            setBusy(false);
          }
        }}
        fields={[
          {
            label: "캐릭터 이름",
            value: newName,
            placeholder: "예: 윤세아",
            autoFocus: true,
            onChange: (v) => {
              setNewName(v);
              if (!slugTouched) {
                const suggestedBase = slugify(v) || "new-character";
                setNewSlug(makeUniqueSlug(suggestedBase, new Set(Array.from(usedSlugs))));
              }
            },
          },
          {
            label: "slug (영문/숫자/하이픈)",
            value: newSlug,
            placeholder: "예: yoon-se-ah",
            helperText: "중복이면 자동으로 -2, -3…을 붙여 생성됩니다.",
            onChange: (v) => {
              setSlugTouched(true);
              setNewSlug(v);
            },
          },
        ]}
      />
    </div>
  );
}

