"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useStudioStore } from "@/lib/studio/store";
import {
  studioCreateCharacter,
  studioDeleteCharacter,
  studioGetProject,
  studioListCharacters,
  studioPublishCharacter,
  studioUnpublishCharacter,
} from "@/lib/studio/db";
import type { StudioCharacterRow, StudioProjectRow } from "@/lib/studio/db";
import { StudioConfirmDialog, StudioFormDialog } from "@/app/studio/_components/StudioDialogs";

function StatusPill({ status }: { status: "draft" | "published" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-extrabold",
        status === "published" ? "bg-[#22c55e]/15 text-[#6ee7b7]" : "bg-white/10 text-white/55"
      )}
    >
      {status === "published" ? "배포됨" : "임시저장"}
    </span>
  );
}

export default function ProjectCastPage({ params }: { params: { projectId: string } }) {
  const setSelectedProjectId = useStudioStore((s) => s.setSelectedProjectId);
  const setSelectedCharacterId = useStudioStore((s) => s.setSelectedCharacterId);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [project, setProject] = useState<StudioProjectRow | null>(null);
  const [rows, setRows] = useState<StudioCharacterRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [deployId, setDeployId] = useState<string | null>(null);
  const [deployBusy, setDeployBusy] = useState(false);
  const [unpublishId, setUnpublishId] = useState<string | null>(null);
  const [unpublishBusy, setUnpublishBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    setSelectedProjectId(params.projectId);
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const [p, cs] = await Promise.all([studioGetProject(params.projectId), studioListCharacters({ projectId: params.projectId })]);
        setProject(p);
        setRows(cs);
        if (!p) setErr("프로젝트를 찾을 수 없어요.");
      } catch (e: any) {
        setErr(e?.message || "불러오지 못했어요.");
        setRows(null);
        setProject(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.projectId, setSelectedProjectId]);

  const list = useMemo(() => {
    const all = (rows || []).map((c) => ({
      id: c.id,
      name: c.name,
      roleLabel: c.role_label || "",
      status: c.status === "published" ? ("published" as const) : ("draft" as const),
      updatedAt: (c.updated_at || "").slice(0, 10) || "",
    }));
    const v = q.trim().toLowerCase();
    if (!v) return all;
    return all.filter((c) => c.name.toLowerCase().includes(v) || c.roleLabel.toLowerCase().includes(v));
  }, [rows, q]);

  if (err) return <div className="text-[13px] font-semibold text-white/60">{err}</div>;
  if (!project || loading) return <div className="text-[13px] font-semibold text-white/60">불러오는 중...</div>;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">캐스트(캐릭터)</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">
            프로젝트: <span className="text-white/70">{project.title}</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl bg-[#4F7CFF] px-4 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF]"
          onClick={async () => {
            setErr(null);
            setNewName("");
            setNewSlug("");
            setNewRoleLabel("");
            setCreateOpen(true);
          }}
        >
          + 캐릭터 추가
        </button>
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
          placeholder="이름/역할 검색..."
          className="w-full bg-transparent text-[12px] font-semibold text-white/80 placeholder:text-white/25 outline-none"
        />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid grid-cols-[1fr_120px] gap-3 border-b border-white/10 bg-white/[0.02] px-5 py-3">
          <div className="text-[12px] font-extrabold text-white/55">캐릭터</div>
          <div className="text-right text-[12px] font-extrabold text-white/55">배포</div>
        </div>
        {!list.length ? (
          <div className="px-5 py-6 text-[12px] font-semibold text-white/55">캐스트가 없어요. 오른쪽 위의 + 캐릭터 추가로 만들어주세요.</div>
        ) : null}
        {list.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            className={cn(
              "grid grid-cols-[1fr_120px] gap-3 px-5 py-4",
              "border-t border-white/10 hover:bg-white/[0.04]",
              "focus:outline-none focus:ring-2 focus:ring-[#4F7CFF]/40"
            )}
            onClick={() => {
              setSelectedCharacterId(c.id);
              router.push(`/studio/projects/${params.projectId}/cast/${c.id}/prompt`);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedCharacterId(c.id);
                router.push(`/studio/projects/${params.projectId}/cast/${c.id}/prompt`);
              }
            }}
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-[14px] font-extrabold text-white/85">{c.name}</div>
                <StatusPill status={c.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-white/40">
                <span className="truncate">{c.roleLabel || "역할 미지정"}</span>
                <span className="text-white/20">·</span>
                <span className="text-white/35">
                  최근 수정: <span className="text-white/55">{c.updatedAt}</span>
                </span>
                <span className="text-white/20">·</span>
                <Link
                  href={`/studio/projects/${params.projectId}/cast/${c.id}/prompt`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCharacterId(c.id);
                  }}
                  className="text-white/55 underline decoration-white/20 hover:text-white/75"
                >
                  프롬프트
                </Link>
                <span className="text-white/20">·</span>
                <Link
                  href={`/studio/projects/${params.projectId}/cast/${c.id}/prompt?tab=lorebook`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCharacterId(c.id);
                  }}
                  className="text-white/55 underline decoration-white/20 hover:text-white/75"
                >
                  로어북
                </Link>
                <span className="text-white/20">·</span>
                <Link
                  href={`/studio/projects/${params.projectId}/cast/${c.id}/prompt?tab=triggers`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCharacterId(c.id);
                  }}
                  className="text-white/55 underline decoration-white/20 hover:text-white/75"
                >
                  트리거
                </Link>
                <span className="text-white/20">·</span>
                <Link
                  href={`/studio/projects/${params.projectId}/cast/${c.id}/prompt?tab=author`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCharacterId(c.id);
                  }}
                  className="text-white/55 underline decoration-white/20 hover:text-white/75"
                >
                  오서
                </Link>
                <span className="text-white/20">·</span>
                <Link
                  href={`/studio/projects/${params.projectId}/cast/${c.id}/prompt?tab=memo`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCharacterId(c.id);
                  }}
                  className="text-white/55 underline decoration-white/20 hover:text-white/75"
                >
                  메모
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              {c.status !== "published" ? (
                <button
                  type="button"
                  className="rounded-full bg-[#4F7CFF]/15 px-3 py-2 text-[11px] font-extrabold text-[#8FB1FF] hover:bg-[#4F7CFF]/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeployId(c.id);
                  }}
                >
                  배포하기
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-full bg-[#ff3d4a]/15 px-3 py-2 text-[11px] font-extrabold text-[#ff9aa1] hover:bg-[#ff3d4a]/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUnpublishId(c.id);
                  }}
                >
                  배포중지
                </button>
              )}
              <button
                type="button"
                className="px-2 py-2 text-[11px] font-extrabold text-[#ff9aa1] hover:text-[#ff6b78]"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(c.id);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      <StudioFormDialog
        open={createOpen}
        title="캐릭터 추가"
        description={`프로젝트: ${project?.title || ""}`}
        submitText="생성"
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onSubmit={async () => {
          const name = newName.trim();
          if (!name) {
            setErr("캐릭터 이름을 입력하세요.");
            return;
          }
          const slug = newSlug.trim();
          if (!slug) {
            setErr("slug를 입력하세요.");
            return;
          }
          const roleLabel = newRoleLabel.trim();
          setErr(null);
          setBusy(true);
          try {
            await studioCreateCharacter({ projectId: params.projectId, name, slug, roleLabel });
            const cs = await studioListCharacters({ projectId: params.projectId });
            setRows(cs);
            setCreateOpen(false);
          } catch (e: any) {
            setErr(e?.message || "생성에 실패했어요.");
          } finally {
            setBusy(false);
          }
        }}
        fields={[
          { label: "이름", value: newName, placeholder: "예: 윤세아", autoFocus: true, onChange: setNewName },
          { label: "slug", value: newSlug, placeholder: "예: yoon-se-ah", helperText: "영문/숫자/하이픈", onChange: setNewSlug },
          { label: "역할(선택)", value: newRoleLabel, placeholder: "예: 여주 / 남주 / 배우자 / 비서 / 빌런", onChange: setNewRoleLabel },
        ]}
      />

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
            const cs = await studioListCharacters({ projectId: params.projectId });
            setRows(cs);
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
            const cs = await studioListCharacters({ projectId: params.projectId });
            setRows(cs);
          } catch (e: any) {
            setErr(e?.message || "배포중지에 실패했어요.");
          } finally {
            setUnpublishBusy(false);
          }
        }}
      />

      <StudioConfirmDialog
        open={Boolean(deleteId)}
        title="캐릭터를 삭제할까요?"
        description={"- 캐릭터의 프롬프트/로어북/트리거도 함께 삭제됩니다.\n- 복구 불가"}
        destructive
        confirmText="삭제"
        cancelText="취소"
        busy={deleteBusy}
        onClose={() => {
          if (deleteBusy) return;
          setDeleteId(null);
        }}
        onConfirm={async () => {
          if (!deleteId) return;
          setErr(null);
          setDeleteBusy(true);
          try {
            await studioDeleteCharacter(deleteId);
            setDeleteId(null);
            const cs = await studioListCharacters({ projectId: params.projectId });
            setRows(cs);
          } catch (e: any) {
            setErr(e?.message || "삭제에 실패했어요.");
          } finally {
            setDeleteBusy(false);
          }
        }}
      />
    </div>
  );
}

