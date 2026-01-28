"use client";

import { useMemo, useState } from "react";

export function AdminSectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">{title}</div>
        {subtitle ? <div className="mt-1 text-[12px] font-semibold text-white/45">{subtitle}</div> : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function AdminButton({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const cls =
    variant === "primary"
      ? "bg-[#ff4da7] text-white"
      : variant === "danger"
        ? "bg-[#ff3d4a] text-white"
        : "bg-white/[0.03] text-white/80 ring-1 ring-white/10 hover:bg-white/[0.05]";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-[12px] font-extrabold ${cls} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function AdminInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-[12px] font-bold text-white/55">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
      />
    </label>
  );
}

export function AdminTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <div className="text-[12px] font-bold text-white/55">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
      />
    </label>
  );
}

export function AdminTable({
  columns,
  rows,
}: {
  columns: Array<{ key: string; header: string; className?: string }>;
  rows: Array<Record<string, React.ReactNode>>;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="admin-scroll overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-white/[0.03]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap px-4 py-3 text-left text-[12px] font-extrabold text-white/55 ${c.className || ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-t border-white/10">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-white/80 ${c.className || ""}`}
                  >
                    {r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function useAdminCrudList<T extends { id: string }>(initial: T[]) {
  const [items, setItems] = useState<T[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);

  return {
    items,
    setItems,
    selectedId,
    setSelectedId,
    selected,
  };
}

