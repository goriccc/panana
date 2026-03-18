"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";

type ChargeItem = {
  id: string;
  date: string;
  pAmount: number;
  amountKrw: number | null;
  description?: string;
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ChargeHistoryClient() {
  const [list, setList] = useState<ChargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/charge-history")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && Array.isArray(data.list)) setList(data.list);
        else setError(data?.error ?? "내역을 불러올 수 없어요.");
      })
      .catch(() => {
        if (!cancelled) setError("내역을 불러올 수 없어요.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title="충전내역" backHref="/my/charge" />

      <main className="mx-auto w-full max-w-[420px] px-5 pb-16 pt-2">
        {loading ? (
          <div className="py-12 text-center text-[14px] text-white/50">불러오는 중...</div>
        ) : error ? (
          <div className="rounded-xl bg-red-500/15 px-4 py-3 text-[13px] text-red-300">{error}</div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-white/50">충전 내역이 없어요.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white/50">
              <span>일자</span>
              <span className="text-right">충전 파나나</span>
              <span className="text-right">충전금액</span>
            </div>
            {list.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/10 px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 text-[13px] text-white/90">{formatDate(item.date)}</div>
                <div className="text-right text-[13px] font-semibold text-[#f29ac3]">
                  +{item.pAmount.toLocaleString("ko-KR")}P
                </div>
                <div className="text-right text-[13px] text-white/70">
                  {item.amountKrw != null ? `${item.amountKrw.toLocaleString("ko-KR")}원` : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
