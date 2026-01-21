"use client";

import { useState } from "react";
import { AdminButton, AdminInput, AdminSectionHeader, AdminTextarea } from "../_components/AdminUI";

export default function AdminSitePage() {
  const [siteName, setSiteName] = useState("Panana");
  const [siteDescription, setSiteDescription] = useState(
    "버블챗/제타 스타일의 캐릭터 채팅 경험을 Panana에서 시작해보세요."
  );
  const [metadataBase, setMetadataBase] = useState("https://panana.local");
  const [footerLine1, setFooterLine1] = useState("© Panana");
  const [footerLine2, setFooterLine2] = useState("문의: support@panana.app");
  const [socialImageUrl, setSocialImageUrl] = useState("/panana.png");
  const [robotsIndex, setRobotsIndex] = useState(true);

  return (
    <div>
      <AdminSectionHeader
        title="사이트(푸터/SEO)"
        subtitle="사이트 메타/푸터/OG 이미지를 관리합니다. (현재는 미리보기 UI, 실제 반영은 Supabase+서버 컴포넌트 연동으로 처리)"
        right={<AdminButton onClick={() => alert("저장(더미) 완료")}>저장</AdminButton>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[13px] font-extrabold text-white/80">편집</div>
          <div className="mt-4 space-y-4">
            <AdminInput label="사이트 이름" value={siteName} onChange={setSiteName} />
            <AdminTextarea label="사이트 설명" value={siteDescription} onChange={setSiteDescription} rows={4} />
            <AdminInput label="metadataBase" value={metadataBase} onChange={setMetadataBase} />
            <AdminInput label="OG 이미지 URL" value={socialImageUrl} onChange={setSocialImageUrl} />
            <div className="rounded-2xl border border-white/10 bg-[#0b0c10] p-4">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-extrabold text-white/70">robots index</div>
                <button
                  type="button"
                  onClick={() => setRobotsIndex((v) => !v)}
                  className={`h-8 w-14 rounded-full border border-white/10 p-1 ${
                    robotsIndex ? "bg-[#ff4da7]" : "bg-white/[0.06]"
                  }`}
                >
                  <div
                    className={`h-6 w-6 rounded-full bg-white transition-transform ${
                      robotsIndex ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <div className="mt-2 text-[11px] font-semibold text-white/35">
                운영에서 인덱스 OFF가 필요하면 여기서 관리하도록 설계할 수 있습니다.
              </div>
            </div>

            <AdminInput label="푸터 1행" value={footerLine1} onChange={setFooterLine1} />
            <AdminInput label="푸터 2행" value={footerLine2} onChange={setFooterLine2} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[13px] font-extrabold text-white/80">미리보기(요약)</div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b0c10] p-5">
            <div className="text-[14px] font-extrabold text-white/90">{siteName}</div>
            <div className="mt-1 text-[12px] font-semibold text-white/45">{siteDescription}</div>
            <div className="mt-4 text-[11px] font-semibold text-white/35">
              metadataBase: {metadataBase}
              <br />
              OG: {socialImageUrl}
              <br />
              robots: {robotsIndex ? "index,follow" : "noindex,nofollow"}
            </div>
            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="text-[11px] font-semibold text-white/45">{footerLine1}</div>
              <div className="mt-1 text-[11px] font-semibold text-white/35">{footerLine2}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

