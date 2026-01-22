"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export type StudioSelectOption = { value: string; label: string };

export function StudioSelect({
  value,
  options,
  placeholder = "선택하세요",
  onChange,
  disabled,
  allowClear = false,
}: {
  value: string;
  options: StudioSelectOption[];
  placeholder?: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(() => options.find((o) => o.value === value)?.label || "", [options, value]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      const t = e.target as Node;
      if (!rootRef.current.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "mt-2 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-left text-[13px] font-semibold outline-none",
          disabled ? "text-white/30" : "text-white/80 hover:bg-black/30"
        )}
      >
        <span className={cn("min-w-0 truncate", selectedLabel ? "text-white/85" : "text-white/35")}>
          {selectedLabel || placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {allowClear && !disabled && value ? (
            <span
              className="grid h-6 w-6 place-items-center rounded-md bg-white/5 text-white/55 ring-1 ring-white/10 hover:bg-white/10 hover:text-white/80"
              role="button"
              tabIndex={0}
              aria-label="선택 해제"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
            >
              ×
            </span>
          ) : null}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className={cn("shrink-0", disabled ? "opacity-40" : "opacity-80")}
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0B0F18] shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
          <div className="max-h-[280px] overflow-auto studio-scrollbar p-1">
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-lg px-3 py-2 text-[13px] font-semibold",
                    active ? "bg-[#4F7CFF]/15 text-[#8FB1FF]" : "text-white/75 hover:bg-white/[0.04]"
                  )}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
            {!options.length ? <div className="px-3 py-2 text-[12px] font-semibold text-white/35">옵션이 없어요.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

