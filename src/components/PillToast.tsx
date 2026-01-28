"use client";

export type PillToastType = "success" | "error" | "warning";

export function PillToast({
  open,
  type,
  message,
}: {
  open: boolean;
  type: PillToastType;
  message: string;
}) {
  if (!open || !message) return null;

  const palette =
    type === "success"
      ? { bg: "bg-[#2fd37c]", text: "text-[#0B0C10]", ring: "ring-[#2fd37c]/40" }
      : type === "warning"
        ? { bg: "bg-[#f5c542]", text: "text-[#0B0C10]", ring: "ring-[#f5c542]/45" }
        : { bg: "bg-[#ff5f6d]", text: "text-[#0B0C10]", ring: "ring-[#ff5f6d]/45" };

  return (
    <div className="fixed left-1/2 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2 px-4" role="status" aria-live="polite">
      <div
        className={[
          "rounded-full px-6 py-3 text-[14px] font-normal shadow-[0_12px_30px_rgba(0,0,0,0.35)] ring-1",
          "whitespace-nowrap animate-[pillToast_1.6s_ease-in-out]",
          palette.bg,
          palette.text,
          palette.ring,
        ].join(" ")}
      >
        {message}
      </div>
      <style>{`
        @keyframes pillToast {
          0% { opacity: 0; transform: translateY(10px) scale(0.98); }
          12% { opacity: 1; transform: translateY(0) scale(1); }
          82% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.98); }
        }
      `}</style>
    </div>
  );
}
