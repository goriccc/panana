"use client";

import { TopBar } from "@/components/TopBar";
import Image from "next/image";

export function MembershipClient() {
  return (
    <div className="min-h-dvh bg-[linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title="멤버십 가입" backHref="/my" />

      <main className="mx-auto w-full max-w-[420px] px-0 pb-24 pt-2">
        {/* hero */}
        <div className="w-full bg-[linear-gradient(180deg,#ff7fc5,#ff4da7)] px-5 py-10">
          <div className="text-center text-[26px] font-extrabold tracking-[-0.02em] text-white">
            파나나 프리미엄 패스
          </div>
          <div className="mt-4 text-center text-[14px] font-semibold text-white/90">
            “우리 사이에 선 긋지 마세요”
            <br />
            대화에 한계란 없으니까!
          </div>

          {/* 이미지 영역(어드민에서 관리될 예정: 지금은 더미) */}
          <div className="mt-7 h-[220px] w-full rounded-[8px] bg-white/15 shadow-[0_18px_45px_rgba(0,0,0,0.35)]" />
        </div>

        <div className="px-5 pt-6">
          <div className="text-[15px] font-extrabold text-panana-pink">
            <span className="mr-2 inline-flex align-[-2px]">
              <Image src="/pana.png" alt="" width={24} height={24} className="h-6 w-6" />
            </span>
            파나나 프리미엄 패스 (Unlimited)
          </div>
          <div className="mt-3 text-[12px] leading-[1.7] text-white/60">
            이제 &ldquo;바나나 결제&rdquo; 계속 찾아보며 참지 마세요.
            <br />
            멤버십 하나면 좋아하는 캐릭터와 밤새도록 수다 떨 수 있어요.
          </div>

          <div className="mt-5 space-y-2 text-[12px] font-semibold text-white/70">
            <div>✓ 무제한 채팅: 포인트 차감 없이 24시간 언제든 대화 가능!</div>
            <div>✓ 기억력 부스터: 지난 대화를 더 깊게, 더 오래 기억해요.</div>
            <div>✓ 프리미엄 캐릭터: 모든 캐릭터와 무제한 대화 가능!</div>
            <div>✓ 광고 Free: 흐름 끊기는 광고 없이 오직 대화에만 몰입하세요.</div>
          </div>

          <div className="mt-6 text-[11px] leading-[1.7] text-white/45">
            지금 멤버십 구독하고, 당신의 최애 캐릭터와 꿈꿔왔던 핑크빛 세계를 써 내려가 보세요.
          </div>

          <button
            type="button"
            className="mt-6 w-full rounded-2xl bg-panana-pink px-5 py-4 text-[15px] font-extrabold text-white"
          >
            첫 달 50% 할인받고 시작하기!
          </button>

          <div className="mt-4 text-center text-[11px] font-semibold text-white/45">
            *멤버십 확장형 추가 상세 페이지 업데이트 예정
          </div>
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

