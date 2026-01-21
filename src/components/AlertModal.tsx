import { SurfaceCard } from "@/components/SurfaceCard";

export function AlertModal({
  open,
  title = "알림",
  message,
  cancelHref,
  confirmHref,
  onConfirm,
  cancelText = "건너뛰기",
  confirmText = "이어하기",
}: {
  open: boolean;
  title?: string;
  message: string;
  cancelHref: string;
  confirmHref?: string;
  onConfirm?: () => void;
  cancelText?: string;
  confirmText?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div className="absolute inset-0 grid place-items-center px-6">
        <SurfaceCard variant="outglow" className="w-full max-w-[520px] p-6">
          <div className="text-center text-[16px] font-semibold text-white/90">{title}</div>
          <div className="mt-4 whitespace-pre-line text-center text-[14px] leading-[1.45] text-white/70">
            {message}
          </div>

          <div className="mt-6 flex gap-4">
            <a
              href={cancelHref}
              className="flex-1 basis-0 rounded-xl bg-white px-4 py-3 text-center text-[15px] font-semibold text-[#0B0C10]"
            >
              {cancelText}
            </a>

            {onConfirm ? (
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 basis-0 rounded-xl bg-panana-pink px-4 py-3 text-center text-[15px] font-semibold text-white"
              >
                {confirmText}
              </button>
            ) : (
              <a
                href={confirmHref || "#"}
                className="flex-1 basis-0 rounded-xl bg-panana-pink px-4 py-3 text-center text-[15px] font-semibold text-white"
              >
                {confirmText}
              </a>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}