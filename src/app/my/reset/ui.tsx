"use client";

import { useState } from "react";
import { SurfaceCard } from "@/components/SurfaceCard";
import { TopBar } from "@/components/TopBar";

function ResetConfirmModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="absolute inset-0 grid place-items-center px-6">
        <SurfaceCard variant="outglow" className="w-full max-w-[520px] p-6">
          <div className="text-center text-[16px] font-semibold text-white/90">알림</div>
          <div className="mt-4 whitespace-pre-line text-center text-[14px] leading-[1.45] text-white/70">
            초기화 후에는 다시 되돌릴 수 없어요.
            {"\n"}
            정말 다시 시작하시나요?
          </div>

          <div className="mt-6 flex gap-4">
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 basis-0 rounded-xl bg-white px-4 py-3 text-center text-[15px] font-semibold text-[#0B0C10]"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 basis-0 rounded-xl bg-panana-pink px-4 py-3 text-center text-[15px] font-semibold text-white"
            >
              유지하기
            </button>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

export function ResetClient() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title="초기화" backHref="/my" />

      <main className="mx-auto w-full max-w-[420px] px-0 pb-20 pt-2">
        <div className="border-t border-white/10">
          <div className="flex items-start justify-between gap-4 px-5 py-5">
            <div>
              <div className="text-[14px] font-semibold text-white/80">대화 내용 초기화</div>
              <div className="mt-1 text-[11px] font-semibold text-white/35">
                진행 중인 대화가 모두 사라져요!
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 whitespace-nowrap text-[13px] font-extrabold text-[#ff4f9a]"
              onClick={() => setOpen(true)}
            >
              초기화
            </button>
          </div>

          <div className="border-t border-white/10" />

          <div className="flex items-start justify-between gap-4 px-5 py-5">
            <div>
              <div className="text-[14px] font-semibold text-white/80">서비스 이용 초기화</div>
              <div className="mt-1 text-[11px] font-semibold text-white/35">
                처음 왔던 난처한 입국 심사부터 모두 다시 시작해요!
                {"\n"}
                보유한 파나나 포인트는 사라지지 않아요.
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 whitespace-nowrap text-[13px] font-extrabold text-[#ff4f9a]"
              onClick={() => setOpen(true)}
            >
              초기화
            </button>
          </div>

          <div className="border-t border-white/10" />
        </div>
      </main>

      <ResetConfirmModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
        }}
      />
    </div>
  );
}

