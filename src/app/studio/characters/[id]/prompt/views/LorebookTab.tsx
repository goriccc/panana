"use client";

import { useMemo, useState } from "react";
import { useStudioStore } from "@/lib/studio/store";
import type { PromptLorebookItem } from "@/lib/studio/types";
import { cn } from "@/lib/utils/cn";
import { studioSkuCatalog } from "@/lib/studio/monetization";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

function DiamondIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l4 4 5 2-9 12L3 9l5-2 4-4Z"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
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
          : "border-white/10 bg-white/[0.03] text-white/65"
      )}
    >
      {type === "paid_item" ? <DiamondIcon className="opacity-90" /> : null}
      <select
        value={type}
        onChange={(e) => {
          const t = e.target.value as PromptLorebookItem["unlock"]["type"];
          if (t === "public") onChange({ type: "public" });
          else if (t === "affection") onChange({ type: "affection", min: 30 });
          else onChange({ type: "paid_item", sku: "DIAMOND_01" });
        }}
        className="bg-transparent text-[12px] font-extrabold text-inherit outline-none"
      >
        <option value="public">기본 공개</option>
        <option value="affection">호감도 조건</option>
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
          <span className="text-[11px] font-extrabold">SKU</span>
          <input
            value={value.sku}
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
    </div>
  );
}

export function LorebookTab({ characterId }: { characterId: string }) {
  const prompt = useStudioStore((s) => s.getPrompt(characterId));
  const setPrompt = useStudioStore((s) => s.setPrompt);

  const [globalFilter, setGlobalFilter] = useState("");

  const data = prompt.lorebook;

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

