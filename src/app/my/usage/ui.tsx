"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";

type UsageItem = {
  id: string;
  date: string;
  pDeducted: number;
  description: string;
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

/** 내용에서 claude_/gemini_ 접두사 제거 → 하이쿠·소넷·플래시·프로만 표시 */
function formatDescription(description: string): string {
  return description
    .replace(/claude_haiku/g, "haiku")
    .replace(/claude_sonnet/g, "sonnet")
    .replace(/gemini_flash/g, "flash")
    .replace(/gemini_pro/g, "pro");
}

export function UsageHistoryClient() {
  const [list, setList] = useState<UsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/usage-history")
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
      <TopBar title="차감내역" backHref="/my/charge" />

      <main className="mx-auto w-full max-w-[420px] px-5 pb-16 pt-2">
        {loading ? (
          <div className="py-12 text-center text-[14px] text-white/50">불러오는 중...</div>
        ) : error ? (
          <div className="rounded-xl bg-red-500/15 px-4 py-3 text-[13px] text-red-300">{error}</div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-white/50">차감 내역이 없어요.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div
              className="grid gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-white/50"
              style={{ gridTemplateColumns: "1fr 5rem minmax(0, 1fr)" }}
            >
              <span>일자</span>
              <span className="text-right">소진 파나나</span>
              <span className="min-w-0 truncate text-right">내용</span>
            </div>
            {list.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 border-b border-white/10 px-4 py-3 last:border-b-0"
                style={{ gridTemplateColumns: "1fr 5rem minmax(0, 1fr)" }}
              >
                <div className="min-w-0 text-[11px] text-white/90 whitespace-nowrap">{formatDate(item.date)}</div>
                <div className="text-right text-[13px] font-semibold text-amber-300/90">
                  -{item.pDeducted.toLocaleString("ko-KR")}P
                </div>
                <div className="min-w-0 truncate text-right text-[12px] text-white/60" title={item.description}>
                  {formatDescription(item.description)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
