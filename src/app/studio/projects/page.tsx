"use client";

import { useEffect, useMemo, useState } from "react";
import { studioCreateProject, studioListProjects, type StudioProjectRow } from "@/lib/studio/db";
import { studioDeleteProject } from "@/lib/studio/db";
import Link from "next/link";
import { StudioConfirmDialog, StudioFormDialog } from "@/app/studio/_components/StudioDialogs";
import { getBrowserSupabase } from "@/lib/supabase/browser";

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
  const s = raw ? raw : "new-project";
  if (!used.has(s)) return s;
  for (let i = 2; i <= 50; i++) {
    const suffix = `-${i}`;
    const trimmed = s.length + suffix.length <= 64 ? s : s.slice(0, Math.max(1, 64 - suffix.length));
    const candidate = `${trimmed}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${s.slice(0, 50)}-${Date.now().toString().slice(-6)}`;
}

export default function StudioProjectsPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<StudioProjectRow[] | null>(null);
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const data = await studioListProjects();
      setRows(data);

      // "배포됨" 기준(임시): 이 프로젝트에 status='published' 캐릭터/씬이 하나라도 있으면 배포됨으로 표시
      // - project 자체 publish 컬럼이 없어서 운영상 가장 실용적인 기준으로 표시
      try {
        const supabase = getBrowserSupabase();
        const [pc, ps] = await Promise.all([
          supabase.from("characters").select("project_id").eq("status", "published"),
          supabase.from("scenes").select("project_id").eq("status", "published"),
        ]);
        const ids = new Set<string>();
        if (!pc.error) (pc.data || []).forEach((r: any) => (r?.project_id ? ids.add(String(r.project_id)) : null));
        if (!ps.error) (ps.data || []).forEach((r: any) => (r?.project_id ? ids.add(String(r.project_id)) : null));
        setPublishedIds(ids);
      } catch {
        setPublishedIds(new Set());
      }
    } catch (e: any) {
      setErr(e?.message || "프로젝트를 불러오지 못했어요.");
      setRows(null);
      setPublishedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const usedSlugs = useMemo(() => new Set((rows || []).map((r) => String(r.slug || "").toLowerCase()).filter(Boolean)), [rows]);

  const items = useMemo(() => {
    const v = q.trim().toLowerCase();
    const base = (rows || []).map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle || "",
      updatedAt: (p.updated_at || "").slice(0, 10) || "",
      published: publishedIds.has(p.id),
    }));
    if (!v) return base;
    return base.filter((p) => p.title.toLowerCase().includes(v) || (p.subtitle || "").toLowerCase().includes(v));
  }, [q, rows, publishedIds]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">프로젝트(세계관)</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">
            세계관(프로젝트) 아래에 캐스트(여러 캐릭터)와 씬(드라마 진행)을 구성합니다.
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#4F7CFF] px-4 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF]"
          onClick={() => {
            setErr(null);
            setNewTitle("");
            setNewSlug("");
            setSlugTouched(false);
            setCreateOpen(true);
          }}
        >
          + 새 프로젝트
        </button>
      </div>

      {err ? <div className="mt-3 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
      {loading ? <div className="mt-3 text-[12px] font-semibold text-white/45">불러오는 중...</div> : null}

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
          placeholder="프로젝트 검색..."
          className="w-full bg-transparent text-[12px] font-semibold text-white/80 placeholder:text-white/25 outline-none"
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!items.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-[12px] font-semibold text-white/55">
            프로젝트가 없어요. 오른쪽 위의 <span className="text-white/75">+ 새 프로젝트</span>로 만들어주세요.
          </div>
        ) : null}
        {items.map((p) => (
          <div key={p.id} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]">
            <Link href={`/studio/projects/${p.id}`} className="block">
              <div className="flex items-start gap-2 pr-10">
                <div className="flex-1 whitespace-normal break-words text-[14px] font-extrabold text-white/85 leading-[1.25]">
                  {p.title}
                </div>
                {p.published ? (
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#6ee7b7] ring-1 ring-[#22c55e]/25">
                    배포됨
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[12px] font-semibold text-white/40">{p.subtitle}</div>
              <div className="mt-4 text-[11px] font-semibold text-white/35">
                최근 수정: <span className="text-white/55">{p.updatedAt}</span>
              </div>
            </Link>

            <button
              type="button"
              title="프로젝트 삭제"
              aria-label="프로젝트 삭제"
              className="absolute right-3 top-3 text-[12px] font-extrabold text-[#ff9aa1] hover:text-[#ff6b78] disabled:opacity-50"
              disabled={busyId === p.id}
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setErr(null);
                setDeleteTarget({ id: p.id, title: p.title });
                setDeleteOpen(true);
              }}
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <StudioFormDialog
        open={createOpen}
        title="새 프로젝트 만들기"
        description="세계관(프로젝트) 이름과 slug를 입력하세요."
        submitText="생성"
        onClose={() => setCreateOpen(false)}
        onSubmit={async () => {
          setErr(null);
          const title = newTitle.trim();
          if (!title) {
            setErr("프로젝트 이름을 입력하세요.");
            return;
          }
          const base = slugify(newSlug.trim() || slugify(title) || "new-project") || "new-project";
          let nextSlug = makeUniqueSlug(base, new Set(Array.from(usedSlugs)));
          setBusyId("creating");
          try {
            for (let attempt = 0; attempt < 6; attempt++) {
              try {
                await studioCreateProject({ slug: nextSlug, title });
                break;
              } catch (e: any) {
                const msg = String(e?.message || "");
                const isDup = msg.includes("duplicate key value") || msg.includes("projects_slug_key") || e?.code === "23505";
                if (!isDup) throw e;
                usedSlugs.add(nextSlug);
                nextSlug = makeUniqueSlug(nextSlug, usedSlugs);
                if (attempt === 5) throw e;
              }
            }
            setCreateOpen(false);
            await load();
          } catch (e: any) {
            setErr(e?.message || "생성에 실패했어요.");
          } finally {
            setBusyId(null);
          }
        }}
        busy={busyId === "creating"}
        fields={[
          {
            label: "프로젝트 이름",
            value: newTitle,
            placeholder: "예: 얼음성",
            autoFocus: true,
            onChange: (v) => {
              setNewTitle(v);
              if (!slugTouched) {
                const suggestedBase = slugify(v) || "new-project";
                setNewSlug(makeUniqueSlug(suggestedBase, new Set(Array.from(usedSlugs))));
              }
            },
          },
          {
            label: "slug (영문/숫자/하이픈)",
            value: newSlug,
            placeholder: "예: ice-castle",
            helperText: "중복이면 자동으로 -2, -3…을 붙여 생성됩니다.",
            onChange: (v) => {
              setSlugTouched(true);
              setNewSlug(v);
            },
          },
        ]}
      />

      <StudioConfirmDialog
        open={deleteOpen}
        title="프로젝트를 삭제할까요?"
        description={
          deleteTarget
            ? `- 프로젝트: ${deleteTarget.title}\n- 포함된 캐릭터/씬/로어북/트리거도 함께 삭제될 수 있어요.\n- 복구 불가`
            : ""
        }
        destructive
        confirmText="삭제"
        busy={busyId === deleteTarget?.id}
        onClose={() => {
          if (busyId) return;
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setErr(null);
          setBusyId(deleteTarget.id);
          try {
            await studioDeleteProject({ projectId: deleteTarget.id });
            setDeleteOpen(false);
            setDeleteTarget(null);
            await load();
          } catch (e: any) {
            setErr(e?.message || "삭제에 실패했어요.");
          } finally {
            setBusyId(null);
          }
        }}
      />
    </div>
  );
}

