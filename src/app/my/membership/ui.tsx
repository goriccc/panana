"use client";

import { TopBar } from "@/components/TopBar";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PublicMembershipBanner } from "@/lib/pananaApp/membershipPublic";

export function MembershipClient({ banners }: { banners: PublicMembershipBanner[] }) {
  const items = useMemo(() => (banners || []).filter((b) => Boolean(b?.image_url)), [banners]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((v) => (v + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);

  useEffect(() => {
    if (idx >= items.length) setIdx(0);
  }, [idx, items.length]);

  const current = items[idx] || null;

  return (
    <div className="min-h-dvh bg-[linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title="멤버십 가입" backHref="/my" />

      <main className="mx-auto w-full max-w-[420px] px-0 pb-24 pt-2">
        {/* 배너만 깔끔하게 */}
        <div className="px-5 pt-3">
          {current ? (
            <div className="overflow-hidden border border-white/10 bg-white/[0.02] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
              <Link href={current.link_url || "/my/membership"} className="block">
                <Image
                  src={current.image_url}
                  alt={current.title || "멤버십 배너"}
                  width={1200}
                  height={675}
                  className="h-auto w-full"
                  sizes="(max-width: 420px) 100vw, 420px"
                  priority
                />
              </Link>
            </div>
          ) : (
            <div className="h-[220px] w-full border border-white/10 bg-white/[0.02]" />
          )}

          {items.length > 1 ? (
            <div className="mt-3 flex items-center justify-center gap-2">
              {items.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  aria-label={`배너 ${i + 1}`}
                  className={`h-2 w-2 rounded-full transition ${i === idx ? "bg-white/80" : "bg-white/25 hover:bg-white/45"}`}
                  onClick={() => setIdx(i)}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-12 border-t border-white/10 px-5 pt-8">
          <div className="text-[13px] font-extrabold text-white/80">멤버십 유의사항</div>
          <div className="mt-3 text-[11px] leading-[1.75] text-white/35">
            - 멤버십은 앱/스토어 정책에 따라 결제/해지/환불이 진행될 수 있습니다.
            <br />
            - 구독 기간 중 해지하더라도 다음 결제일까지는 혜택이 유지됩니다.
            <br />
            - 무제한 채팅은 서비스 운영정책 및 공정 사용 정책(FUP)에 따라 제한될 수 있습니다.
          </div>
        </div>
      </main>
    </div>
  );
}

