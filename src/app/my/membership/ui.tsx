"use client";

import { TopBar } from "@/components/TopBar";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicMembershipBanner } from "@/lib/pananaApp/membershipPublic";

type Plan = { id: string; title: string; paymentSku: string; priceKrw: number } | null;

export function MembershipClient({
  banners,
  plan,
  buyerName = "",
  buyerEmail = "",
  buyerPhone = "",
}: {
  banners: PublicMembershipBanner[];
  plan?: Plan;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
}) {
  const items = useMemo(() => (banners || []).filter((b) => Boolean(b?.image_url)), [banners]);
  const [idx, setIdx] = useState(0);
  const [subscribing, setSubscribing] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((v) => (v + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);

  useEffect(() => {
    if (idx >= items.length) setIdx(0);
  }, [idx, items.length]);

  const current = items[idx] || null;

  const handleSubscribe = useCallback(async () => {
    if (!plan || subscribing) return;
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_SUBSCRIPTION;
    if (!storeId || !channelKey) {
      setSubError("구독 결제 설정이 완료되지 않았어요. (Store ID / 구독 채널키)");
      return;
    }
    // 카카오 구독형: EASY_PAY / KG 이니시스 구독형: CARD
    const billingKeyMethod =
      process.env.NEXT_PUBLIC_PORTONE_SUBSCRIPTION_BILLING_METHOD === "EASY_PAY" ? "EASY_PAY" : "CARD";
    const name = (buyerName || "").trim();
    const email = (buyerEmail || "").trim();
    const phone = (buyerPhone || "").trim().replace(/-/g, "");
    if (!name) {
      setSubError("구매자 이름이 필요해요. 로그인된 계정에 표시 이름이 있는지 확인해 주세요.");
      return;
    }
    if (!email) {
      setSubError("구매자 이메일이 필요해요.");
      return;
    }
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      setSubError("구매자 휴대폰 번호가 필요해요. 계정설정에서 등록해 주세요.");
      return;
    }
    setSubError(null);
    setSubscribing(true);
    const paymentId = `panana-sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const issueId = `issue-${paymentId}`;
    const phoneDigits = phone.replace(/\D/g, "");
    try {
      const PortOne = await import("@portone/browser-sdk/v2").then((m) => m.default);
      // KG 이니시스 결제창 방식: requestIssueBillingKey 사용 (loadIssueBillingKeyUI uiType 미지원)
      const issueRes = await PortOne.requestIssueBillingKey({
        storeId,
        channelKey,
        billingKeyMethod,
        issueId,
        displayAmount: plan.priceKrw,
        currency: "KRW",
        issueName: plan.title || "파나나 패스",
        customer: {
          customerId: email,
          fullName: name,
          email,
          phoneNumber: phoneDigits,
        },
      });
      if (issueRes?.code !== undefined) {
        const msg = issueRes?.message ?? "빌링키 발급에 실패했어요.";
        if (!String(msg).includes("취소")) setSubError(msg);
        return;
      }
      const billingKey = issueRes?.billingKey;
      if (!billingKey) {
        setSubError("빌링키를 받지 못했어요.");
        return;
      }
      const confirmRes = await fetch("/api/membership/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingKey,
          paymentId,
          sku: plan.paymentSku,
          orderName: plan.title || "파나나 패스",
          totalAmount: plan.priceKrw,
        }),
      }).then((r) => r.json());
      if (confirmRes?.ok) {
        setSubError(null);
        window.location.reload();
      } else {
        setSubError(confirmRes?.error ?? "멤버십 가입 확인에 실패했어요.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "결제 창을 열 수 없어요.";
      setSubError(msg);
    } finally {
      setSubscribing(false);
    }
  }, [plan, buyerName, buyerEmail, buyerPhone, subscribing]);

  return (
    <div className="min-h-dvh bg-[linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title="멤버십 가입" backHref="/my" />

      <main className="mx-auto w-full max-w-[420px] px-0 pb-24 pt-2">
        {/* 배너만 깔끔하게 */}
        <div className="px-5 pt-3">
          {current ? (
            <div className="overflow-hidden border border-white/10 bg-white/[0.02] shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
              <button
                type="button"
                onClick={handleSubscribe}
                disabled={subscribing}
                className="block w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="멤버십 가입하기"
              >
                <img
                  src={`/api/membership-banner-image?id=${encodeURIComponent(current.id)}`}
                  alt={current.title || "멤버십 배너"}
                  className="h-auto w-full"
                  sizes="(max-width: 420px) 100vw, 420px"
                  fetchPriority="high"
                />
              </button>
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

        {plan ? (
          <div className="mt-10 border-t border-white/10 px-5 pt-8">
            <div className="text-[13px] font-extrabold text-white/80">파나나 패스</div>
            <div className="mt-1 text-[11px] text-white/45">{plan.title} · {plan.priceKrw.toLocaleString("ko-KR")}원/월</div>
            {subError ? (
              <div className="mt-3 rounded-xl bg-red-500/15 px-4 py-3 text-[13px] font-semibold text-red-300">{subError}</div>
            ) : null}
            <button
              type="button"
              disabled={subscribing}
              onClick={handleSubscribe}
              className="mt-4 w-full rounded-2xl bg-panana-pink px-5 py-4 text-[15px] font-normal text-white disabled:opacity-60"
            >
              {subscribing ? "결제 진행 중..." : "멤버십 가입하기"}
            </button>
          </div>
        ) : null}

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

