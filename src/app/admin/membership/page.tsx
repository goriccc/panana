"use client";

import { useState } from "react";
import { AdminButton, AdminInput, AdminSectionHeader, AdminTextarea } from "../_components/AdminUI";

export default function AdminMembershipPage() {
  const [title, setTitle] = useState("멤버십 가입하고 무제한 이용하기");
  const [price, setPrice] = useState("월 9,900원");
  const [cta, setCta] = useState("지금 가입하기");
  const [benefits, setBenefits] = useState(
    ["무제한 캐릭터 채팅", "도전모드 추가 보상", "광고 제거", "우선 지원"].join("\n")
  );
  const [termsUrl, setTermsUrl] = useState("/terms");

  return (
    <div>
      <AdminSectionHeader
        title="멤버십"
        subtitle="마이페이지 > 멤버십 화면의 문구/혜택/가격/CTA/약관 링크를 관리합니다."
        right={<AdminButton onClick={() => alert("저장(더미) 완료")}>저장</AdminButton>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[13px] font-extrabold text-white/80">편집</div>
          <div className="mt-4 space-y-4">
            <AdminInput label="타이틀" value={title} onChange={setTitle} />
            <AdminInput label="가격 표기" value={price} onChange={setPrice} />
            <AdminInput label="CTA 텍스트" value={cta} onChange={setCta} />
            <AdminTextarea label="혜택(줄바꿈=항목)" value={benefits} onChange={setBenefits} rows={10} />
            <AdminInput label="약관 URL" value={termsUrl} onChange={setTermsUrl} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[13px] font-extrabold text-white/80">미리보기</div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b0c10] p-5">
            <div className="text-[14px] font-extrabold text-white/90">{title}</div>
            <div className="mt-1 text-[12px] font-semibold text-white/45">{price}</div>
            <div className="mt-4 space-y-2">
              {benefits
                .split("\n")
                .map((b) => b.trim())
                .filter(Boolean)
                .map((b, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[12px] font-semibold text-white/70">
                    <span className="mt-[2px] inline-block h-2 w-2 rounded-full bg-[#ffa9d6]" />
                    <span>{b}</span>
                  </div>
                ))}
            </div>
            <button
              type="button"
              className="mt-5 w-full rounded-2xl bg-[#ff4da7] px-5 py-4 text-[13px] font-extrabold text-white"
            >
              {cta}
            </button>
            <div className="mt-3 text-[11px] font-semibold text-white/35">약관: {termsUrl}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

