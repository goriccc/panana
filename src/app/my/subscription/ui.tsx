"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { SurfaceCard } from "@/components/SurfaceCard";

export function SubscriptionClient() {
  const router = useRouter();
  const [planName, setPlanName] = useState<string>("");
  const [nextPaymentDate, setNextPaymentDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me/subscription");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          router.replace("/my");
          return;
        }
        setError(data?.error ?? "구독 정보를 불러올 수 없어요.");
        return;
      }
      setPlanName(data.planName ?? "파나나 프리미엄 패스");
      setNextPaymentDate(data.nextPaymentDate ?? null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const handleCancelConfirm = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/membership/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setCancelError(data?.error ?? "해지 처리에 실패했어요.");
        return;
      }
      setCancelOpen(false);
      router.push("/my");
      router.refresh();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#07070B] text-white">
      <TopBar title="구독관리" backHref="/my" />

      <main className="mx-auto w-full max-w-[420px] px-5 pb-24 pt-6">
        {loading ? (
          <div className="text-[14px] text-white/60">구독 정보를 불러오는 중...</div>
        ) : error ? (
          <div className="text-[14px] text-red-400">{error}</div>
        ) : (
          <>
            <div className="border-b border-white/10 pb-5">
              <div className="text-[12px] font-semibold text-white/50">이용중인 멤버십</div>
              <div className="mt-1 text-[16px] font-bold text-white">{planName}</div>
              <div className="mt-2 text-[13px] text-white/60">
                다음 결제일 : {nextPaymentDate ?? "YYYY/MM/DD"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="mt-6 block w-full text-center text-[14px] font-semibold text-panana-pink"
            >
              해지하기
            </button>
          </>
        )}
      </main>

      {cancelOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="absolute inset-0 grid place-items-center px-3">
            <SurfaceCard variant="outglow" className="w-[min(420px,calc(100vw-24px))] p-6">
              <div className="text-center text-[16px] font-semibold text-white/90">알림</div>
              <div className="mt-4 whitespace-pre-line text-center text-[14px] leading-[1.45] text-white/70">
                대화중인 친구들이 아직 있어요!{"\n"}정말 멤버십을 해지할까요?
              </div>
              {cancelError ? (
                <div className="mt-3 text-center text-[13px] text-red-400">{cancelError}</div>
              ) : null}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelConfirm}
                  disabled={cancelling}
                  className="flex-1 rounded-xl bg-white/15 px-4 py-3 text-[14px] font-semibold text-white/90 disabled:opacity-50"
                >
                  {cancelling ? "처리 중..." : "해지하기"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCancelOpen(false);
                    setCancelError(null);
                  }}
                  disabled={cancelling}
                  className="flex-1 rounded-xl bg-panana-pink px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                >
                  계속하기
                </button>
              </div>
            </SurfaceCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
