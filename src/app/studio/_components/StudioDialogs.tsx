"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils/cn";

function Backdrop({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50"
      onMouseDown={(e) => {
        // backdrop click close
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="absolute inset-0 grid place-items-center px-6">{children}</div>
    </div>
  );
}

export function StudioConfirmDialog({
  open,
  title,
  description,
  destructive,
  confirmText = "확인",
  cancelText = "취소",
  onConfirm,
  onClose,
  busy,
}: {
  open: boolean;
  title: string;
  description?: string;
  destructive?: boolean;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <Backdrop open={open} onClose={onClose}>
      <div className="relative z-10 w-full max-w-[520px] rounded-2xl border border-white/10 bg-[#0B0F18] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
        <div className="text-[14px] font-extrabold text-white/85">{title}</div>
        {description ? <div className="mt-3 whitespace-pre-line text-[12px] font-semibold leading-[1.55] text-white/55">{description}</div> : null}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] font-extrabold text-white/70 hover:bg-white/[0.06]"
            onClick={onClose}
            disabled={busy}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-xl px-4 py-3 text-[12px] font-extrabold text-white disabled:opacity-60",
              destructive ? "bg-[#ff4d6d] hover:bg-[#ff2f56]" : "bg-[#4F7CFF] hover:bg-[#3E6BFF]"
            )}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "처리 중..." : confirmText}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

export function StudioFormDialog({
  open,
  title,
  description,
  submitText = "저장",
  cancelText = "취소",
  busy,
  fields,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  submitText?: string;
  cancelText?: string;
  busy?: boolean;
  fields: Array<{
    label: string;
    value: string;
    placeholder?: string;
    helperText?: string;
    autoFocus?: boolean;
    onChange: (v: string) => void;
  }>;
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
}) {
  const firstAutoFocus = useMemo(() => fields.findIndex((f) => f.autoFocus), [fields]);
  const firstRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const idx = firstAutoFocus >= 0 ? firstAutoFocus : 0;
    // allow paint
    const t = window.setTimeout(() => {
      if (idx === 0 && firstRef.current) firstRef.current.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open, firstAutoFocus]);

  if (!open) return null;

  return (
    <Backdrop open={open} onClose={onClose}>
      <div className="relative z-10 w-full max-w-[560px] rounded-2xl border border-white/10 bg-[#0B0F18] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
        <div className="text-[14px] font-extrabold text-white/85">{title}</div>
        {description ? <div className="mt-2 text-[12px] font-semibold text-white/50">{description}</div> : null}

        <div className="mt-5 space-y-3">
          {fields.map((f, i) => (
            <div key={i}>
              <div className="text-[12px] font-extrabold text-white/65">{f.label}</div>
              <input
                ref={i === 0 ? firstRef : undefined}
                value={f.value}
                placeholder={f.placeholder}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[13px] font-semibold text-white/80 outline-none placeholder:text-white/25"
                onChange={(e) => f.onChange(e.target.value)}
              />
              {f.helperText ? <div className="mt-1 text-[11px] font-semibold text-white/35">{f.helperText}</div> : null}
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] font-extrabold text-white/70 hover:bg-white/[0.06]"
            onClick={onClose}
            disabled={busy}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-[#4F7CFF] px-4 py-3 text-[12px] font-extrabold text-white hover:bg-[#3E6BFF] disabled:opacity-60"
            onClick={onSubmit}
            disabled={busy}
          >
            {busy ? "처리 중..." : submitText}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

