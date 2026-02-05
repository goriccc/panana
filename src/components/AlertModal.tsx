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
  maxWidthClassName = "max-w-[620px]",
  cancelTarget,
  confirmTarget,
}: {
  open: boolean;
  title?: string;
  message: string;
  cancelHref: string;
  confirmHref?: string;
  onConfirm?: () => void;
  cancelText?: string;
  confirmText?: string;
  maxWidthClassName?: string;
  /** 확인 버튼(링크일 때) 새 창 열기. 예: 검사결과 다시보기 */
  confirmTarget?: "_blank";
  /** 취소 버튼 새 창 열기 */
  cancelTarget?: "_blank";
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div className="absolute inset-0 grid place-items-center px-8">
        <SurfaceCard variant="outglow" className={`w-full ${maxWidthClassName} p-6`}>
          <div className="text-center text-[16px] font-semibold text-white/90">{title}</div>
          <div className="mt-4 whitespace-pre-line text-center text-[14px] leading-[1.45] text-white/70">
            {message}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6">
            <a
              href={cancelHref}
              className="w-full rounded-xl bg-white px-4 py-3 text-center text-[15px] font-semibold text-[#0B0C10] whitespace-nowrap"
            >
              {cancelText}
            </a>

            {onConfirm ? (
              <button
                type="button"
                onClick={onConfirm}
                className="w-full rounded-xl bg-panana-pink px-4 py-3 text-center text-[15px] font-semibold text-white whitespace-nowrap"
              >
                {confirmText}
              </button>
            ) : (
              <a
                href={confirmHref || "#"}
                className="w-full rounded-xl bg-panana-pink px-4 py-3 text-center text-[15px] font-semibold text-white whitespace-nowrap"
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