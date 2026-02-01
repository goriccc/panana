"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PillToast, type PillToastType } from "@/components/PillToast";
import { SurfaceCard } from "@/components/SurfaceCard";
import { TopBar } from "@/components/TopBar";
import { ensurePananaIdentity } from "@/lib/pananaApp/identity";

function ResetConfirmModal({
  open,
  title,
  message,
  confirmText,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="absolute inset-0 grid place-items-center px-3">
        <SurfaceCard variant="outglow" className="w-[min(420px,calc(100vw-24px))] p-6">
          <div className="text-center text-[16px] font-semibold text-white/90">{title}</div>
          <div className="mt-4 whitespace-pre-line text-center text-[14px] leading-[1.45] text-white/70">
            {message}
          </div>

          <div className="mt-6 flex gap-4">
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 basis-0 whitespace-nowrap rounded-xl bg-white px-4 py-3 text-center text-[15px] font-semibold text-[#0B0C10]"
            >
              {confirmText}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 basis-0 whitespace-nowrap rounded-xl bg-panana-pink px-4 py-3 text-center text-[15px] font-semibold text-white"
            >
              유지하기
            </button>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

function clearLocalByPrefix(prefix: string) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

function clearLocalChatData(pananaId?: string) {
  try {
    // MY 목록
    localStorage.removeItem("panana_my_chats_v1");
  } catch {}

  // 캐릭터별 로컬 대화/런타임
  clearLocalByPrefix(`panana_chat_history_v1:${String(pananaId || "").trim() || "anon"}:`);
  clearLocalByPrefix("panana_chat_runtime:");
}

function clearLocalHomeGenderCache() {
  try {
    localStorage.removeItem("panana_user_gender");
    localStorage.removeItem("panana_gender_shuffle_seed");
    localStorage.removeItem("panana_airport_draft");
  } catch {}
  clearLocalByPrefix("panana_home_category_cache");
}

export function ResetClient() {
  const [open, setOpen] = useState<null | "chat" | "service">(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: PillToastType; message: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const modal = useMemo(() => {
    if (!open) return null;
    if (open === "chat") {
      return {
        title: "대화 내용 초기화",
        confirmText: "초기화",
        message: "초기화 후에는 다시 되돌릴 수 없어요.\n정말 모든 대화 내용을 삭제할까요?",
      };
    }
    return {
      title: "서비스 이용 초기화",
      confirmText: "완전 초기화",
      message: "초기화 후에는 다시 되돌릴 수 없어요.\n입국 심사부터 다시 시작할까요?\n(보유한 파나나 포인트는 유지돼요)",
    };
  }, [open]);

  const showToast = (type: PillToastType, message: string, durationMs?: number) => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ type, message });
    const ms = durationMs ?? (type === "success" ? 1500 : type === "warning" ? 2000 : 2500);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, ms);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <PillToast open={Boolean(toast)} type={toast?.type || "success"} message={toast?.message || ""} />
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
              disabled={busy}
              onClick={() => setOpen("chat")}
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
              disabled={busy}
              onClick={() => setOpen("service")}
            >
              초기화
            </button>
          </div>

          <div className="border-t border-white/10" />
        </div>
      </main>

      <ResetConfirmModal
        open={Boolean(open)}
        title={modal?.title || "알림"}
        message={modal?.message || ""}
        confirmText={modal?.confirmText || "확인"}
        onClose={() => setOpen(null)}
        onConfirm={async () => {
          if (!open) return;
          setBusy(true);
          try {
            const idt = ensurePananaIdentity();
            const pananaId = String(idt.id || "").trim();

            const res = await fetch("/api/me/reset", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ kind: open, pananaId }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.ok) throw new Error(String(data?.error || "초기화에 실패했어요."));

            // 로컬 정리
            clearLocalChatData(pananaId);
            clearLocalHomeGenderCache();

            if (open === "service") {
              // 서비스 이용 초기화: 입국심사부터 다시
              window.location.href = "/airport";
              return;
            }

            showToast("success", "변경 사항이 저장되었습니다.");
          } catch (e: any) {
            showToast("error", e?.message || "문제가 발생했습니다.");
          } finally {
            setBusy(false);
            setOpen(null);
          }
        }}
      />
    </div>
  );
}

