"use client";

import { useEffect, useMemo, useState } from "react";
import { useStudioStore } from "@/lib/studio/store";
import type { PromptLorebookItem } from "@/lib/studio/types";
import { cn } from "@/lib/utils/cn";
import { studioSkuCatalog } from "@/lib/studio/monetization";
import { studioLoadLorebook, studioSaveLorebook } from "@/lib/studio/db";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

function PananaIcon({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff4da7]/25 px-1 text-[10px] font-black text-[#ffb3d7]", className)}>
      P
    </div>
  );
}

function UnlockCell({
  value,
  onChange,
}: {
  value: PromptLorebookItem["unlock"];
  onChange: (u: PromptLorebookItem["unlock"]) => void;
}) {
  const type = value.type;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-2 py-1 text-[12px] font-extrabold",
        type === "paid_item"
          ? "border-[#ff3d4a]/35 bg-[#ff3d4a]/10 text-[#ff9aa1]"
          : type === "condition"
            ? "border-[#7c5cff]/35 bg-[#7c5cff]/10 text-[#c9b8ff]"
          : "border-white/10 bg-white/[0.03] text-white/65"
      )}
    >
      {type === "paid_item" ? <PananaIcon className="opacity-90" /> : null}
      <select
        value={type}
        onChange={(e) => {
          const t = e.target.value as PromptLorebookItem["unlock"]["type"];
          if (t === "public") onChange({ type: "public" });
          else if (t === "affection") onChange({ type: "affection", min: 30 });
          else if (t === "condition") onChange({ type: "condition", expr: "trust>=70", costPanana: 0 });
          else if (t === "ending_route") onChange({ type: "ending_route", endingKey: "", epMin: 7, costPanana: 0 });
          else onChange({ type: "paid_item", sku: "PANA_UNLOCK_01" });
        }}
        className="bg-transparent text-[12px] font-extrabold text-inherit outline-none"
      >
        <option value="public">기본 공개</option>
        <option value="affection">호감도 조건</option>
        <option value="condition">조건식(변수)</option>
        <option value="ending_route">엔딩 루트</option>
        <option value="paid_item">유료 아이템 필요</option>
      </select>

      {type === "affection" ? (
        <span className="inline-flex items-center gap-1 text-white/60">
          <span className="text-[11px] font-extrabold">호감도</span>
          <input
            value={value.min}
            onChange={(e) => onChange({ type: "affection", min: Number(e.target.value) || 0 })}
            className="w-14 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[12px] font-extrabold text-white/75 outline-none"
          />
          <span className="text-[11px] font-extrabold">↑</span>
        </span>
      ) : null}

      {type === "paid_item" ? (
        <span className="inline-flex items-center gap-1 text-[#ff9aa1]">
          <span className="text-[11px] font-extrabold">파나나</span>
          <input
            value={(value as any).sku}
            onChange={(e) => onChange({ type: "paid_item", sku: e.target.value })}
            list="studio-sku-list"
            className="w-28 rounded-lg border border-[#ff3d4a]/35 bg-black/20 px-2 py-1 text-[12px] font-extrabold text-[#ffd0d4] outline-none"
          />
          <datalist id="studio-sku-list">
            {studioSkuCatalog.map((x) => (
              <option key={x.sku} value={x.sku}>
                {x.name}
              </option>
            ))}
          </datalist>
        </span>
      ) : null}

      {type === "condition" ? (
        <span className="inline-flex flex-wrap items-center gap-2 text-[#c9b8ff]">
          <span className="text-[11px] font-extrabold">조건</span>
          <input
            value={(value as any).expr || ""}
            onChange={(e) => onChange({ type: "condition", expr: e.target.value, costPanana: (value as any).costPanana || 0 })}
            placeholder="trust>=70"
            className="w-28 rounded-lg border border-[#7c5cff]/35 bg-black/20 px-2 py-1 text-[12px] font-extrabold text-[#e6dcff] outline-none placeholder:text-[#e6dcff]/35"
          />
          <span className="text-[11px] font-extrabold">비용</span>
          <input
            value={Number((value as any).costPanana || 0)}
            onChange={(e) =>
              onChange({
                type: "condition",
                expr: (value as any).expr || "",
                costPanana: Number(e.target.value) || 0,
              })
            }
            className="w-16 rounded-lg border border-[#7c5cff]/35 bg-black/20 px-2 py-1 text-[12px] font-extrabold text-[#e6dcff] outline-none"
          />
          <span className="text-[11px] font-extrabold">P</span>
        </span>
      ) : null}

      {type === "ending_route" ? (
        <span className="inline-flex flex-wrap items-center gap-2 text-[#c9b8ff]">
          <span className="text-[11px] font-extrabold">엔딩키</span>
          <input
            value={(value as any).endingKey || ""}
            onChange={(e) =>
              onChange({
                type: "ending_route",
                endingKey: e.target.value,
                epMin: (value as any).epMin || 0,
                costPanana: (value as any).costPanana || 0,
              })
            }
            placeholder="partner / ruin / ... (옵션)"
            className="w-32 rounded-lg border border-[#7c5cff]/35 bg-black/20 px-2 py-1 text-[12px] font-extrabold text-[#e6dcff] outline-none placeholder:text-[#e6dcff]/35"
          />
          <span className="text-[11px] font-extrabold">EP≥</span>
          <input
            value={Number((value as any).epMin || 0)}
            onChange={(e) =>
              onChange({
                type: "ending_route",
                endingKey: (value as any).endingKey || "",
                epMin: Number(e.target.value) || 0,
                costPanana: (value as any).costPanana || 0,
              })
            }
            className="w-14 rounded-lg border border-[#7c5cff]/35 bg-black/20 px-2 py-1 text-[12px] font-extrabold text-[#e6dcff] outline-none"
          />
          <span className="text-[11px] font-extrabold">비용</span>
          <input
            value={Number((value as any).costPanana || 0)}
            onChange={(e) =>
              onChange({
                type: "ending_route",
                endingKey: (value as any).endingKey || "",
                epMin: (value as any).epMin || 0,
                costPanana: Number(e.target.value) || 0,
              })
            }
            className="w-16 rounded-lg border border-[#7c5cff]/35 bg-black/20 px-2 py-1 text-[12px] font-extrabold text-[#e6dcff] outline-none"
          />
          <span className="text-[11px] font-extrabold">P</span>
        </span>
      ) : null}
    </div>
  );
}

export function LorebookTab({ characterId }: { characterId: string }) {
  const prompt = useStudioStore((s) => s.getPrompt(characterId));
  const setPrompt = useStudioStore((s) => s.setPrompt);

  const [globalFilter, setGlobalFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const data = prompt.lorebook;

  useEffect(() => {
    // DB → store 로드(1회)
    (async () => {
      try {
        const rows = await studioLoadLorebook(characterId);
        if (!rows?.length) return;
        const next = useStudioStore.getState().getPrompt(characterId);
        setPrompt(characterId, { ...next, lorebook: rows });
      } catch {
        // 실패해도 더미/로컬 상태 유지
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  const updateRow = (id: string, patch: Partial<PromptLorebookItem>) => {
    const next = useStudioStore.getState().getPrompt(characterId);
    setPrompt(characterId, {
      ...next,
      lorebook: next.lorebook.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const columns = useMemo<ColumnDef<PromptLorebookItem>[]>(
    () => [
      { header: "No", cell: (ctx) => ctx.row.index + 1, size: 40 },
      {
        header: "트리거 키워드(Keys)",
        accessorKey: "key",
        cell: (ctx) => <span className="font-extrabold text-white/80">{String(ctx.getValue())}</span>,
      },
      {
        header: "내용(Value)",
        accessorKey: "value",
        cell: (ctx) => <span className="text-white/55">{String(ctx.getValue())}</span>,
      },
      {
        header: "**해금 조건(Unlock)🔒**",
        id: "unlock",
        cell: (ctx) => {
          const row = ctx.row.original;
          return <UnlockCell value={row.unlock} onChange={(u) => updateRow(row.id, { unlock: u })} />;
        },
      },
      {
        header: "관리",
        id: "actions",
        cell: (ctx) => {
          const row = ctx.row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] font-extrabold text-white/70 ring-1 ring-white/10 hover:bg-white/[0.05]"
                onClick={() => alert(`수정(더미): ${row.id}`)}
              >
                수정
              </button>
              <button
                type="button"
                className="rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] font-extrabold text-white/55 ring-1 ring-white/10 hover:bg-white/[0.05]"
                onClick={() => {
                  const next = useStudioStore.getState().getPrompt(characterId);
                  setPrompt(characterId, { ...next, lorebook: next.lorebook.filter((x) => x.id !== row.id) });
                }}
              >
                삭제
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [characterId]
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const v = String(filterValue || "").toLowerCase();
      if (!v) return true;
      const key = String(row.original.key).toLowerCase();
      const value = String(row.original.value).toLowerCase();
      return key.includes(v) || value.includes(v);
    },
  });

  return (
    <div>
      <div className="text-[16px] font-extrabold tracking-[-0.01em] text-white/90">로어북 데이터 관리 (Lorebook Manager)</div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L21 21"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="검색어 입력..."
              className="w-[240px] bg-transparent text-[12px] font-semibold text-white/80 placeholder:text-white/25 outline-none"
            />
          </div>
          <button
            type="button"
            className="rounded-xl bg-white/[0.03] px-3 py-2 text-[12px] font-extrabold text-white/70 ring-1 ring-white/10 hover:bg-white/[0.05]"
            onClick={() => alert("필터(더미)")}
          >
            필터 ▾
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
            disabled={saving}
            onClick={async () => {
              setErr(null);
              setSaving(true);
              try {
                const current = useStudioStore.getState().getPrompt(characterId);
                await studioSaveLorebook(characterId, current.lorebook);
              } catch (e: any) {
                setErr(e?.message || "저장에 실패했어요.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#4F7CFF] px-4 py-2 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF]"
            onClick={() => {
              const next = useStudioStore.getState().getPrompt(characterId);
              setPrompt(characterId, {
                ...next,
                lorebook: [
                  ...next.lorebook,
                  { id: `l-${Date.now()}`, key: "새 키워드", value: "", unlock: { type: "public" } },
                ],
              });
            }}
          >
            + 새 데이터 추가
          </button>
          <button
            type="button"
            className="rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
            onClick={() => alert("엑셀 업로드(더미)")}
          >
            엑셀 업로드
          </button>
        </div>
      </div>
      {err ? <div className="mt-3 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-white/[0.03]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="whitespace-nowrap px-4 py-3 text-left text-[12px] font-extrabold text-white/55"
                  >
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-white/10 bg-black/10">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle text-[13px] font-semibold text-white/80">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] font-extrabold text-white/70 ring-1 ring-white/10 disabled:opacity-40"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ‹
        </button>
        <div className="text-[12px] font-extrabold text-white/55">
          {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
        </div>
        <button
          type="button"
          className="rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] font-extrabold text-white/70 ring-1 ring-white/10 disabled:opacity-40"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          ›
        </button>
      </div>
    </div>
  );
}

