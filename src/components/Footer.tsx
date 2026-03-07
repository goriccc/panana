"use client";

import { useState } from "react";
import { TERMS_OF_SERVICE_KO } from "@/content/termsOfService";
import { PRIVACY_POLICY_KO } from "@/content/privacyPolicy";
import { YOUTH_PROTECTION_POLICY_KO } from "@/content/youthProtectionPolicy";

export function Footer() {
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [youthOpen, setYouthOpen] = useState(false);

  return (
    <>
      <footer className="mt-10 border-t border-white/5 bg-black/10 px-5 pb-10 pt-8 text-white/35">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="text-[13px] font-semibold text-white/45">멀티파이프</div>
          <div className="mt-3 space-y-1 text-[11px] leading-[1.6]">
            <div>대표: 송준호</div>
            <div>사업자등록번호: 304-24-18806</div>
            <div>주소: 경기도 김포시 태장로 765, 6층 607호(장기동, 금광테크노벨리)</div>
            <div>이메일: info@panana.kr</div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="text-white/50 underline underline-offset-2 hover:text-white/70"
            >
              이용약관
            </button>
            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              className="text-white/50 underline underline-offset-2 hover:text-white/70"
            >
              개인정보 처리방침
            </button>
            <button
              type="button"
              onClick={() => setYouthOpen(true)}
              className="text-white/50 underline underline-offset-2 hover:text-white/70"
            >
              청소년 보호정책
            </button>
          </div>
          <div className="mt-2 text-[11px] text-white/25">
            © {new Date().getFullYear()} 멀티파이프. All rights reserved.
          </div>
        </div>
      </footer>

      {termsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3"
          onClick={() => setTermsOpen(false)}
          aria-label="닫기"
        >
          <div
            className="flex h-[85vh] w-[min(520px,100%)] flex-col rounded-2xl border border-white/10 bg-[#0B0C10] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-[15px] font-semibold text-white/90">이용약관</span>
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="p-2 text-white/60 hover:text-white"
                aria-label="닫기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <pre className="whitespace-pre-wrap font-sans text-[12px] leading-[1.65] text-white/80">
                {TERMS_OF_SERVICE_KO}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {privacyOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3"
          onClick={() => setPrivacyOpen(false)}
          aria-label="닫기"
        >
          <div
            className="flex h-[85vh] w-[min(520px,100%)] flex-col rounded-2xl border border-white/10 bg-[#0B0C10] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-[15px] font-semibold text-white/90">개인정보 처리방침</span>
              <button
                type="button"
                onClick={() => setPrivacyOpen(false)}
                className="p-2 text-white/60 hover:text-white"
                aria-label="닫기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <pre className="whitespace-pre-wrap font-sans text-[12px] leading-[1.65] text-white/80">
                {PRIVACY_POLICY_KO}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {youthOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3"
          onClick={() => setYouthOpen(false)}
          aria-label="닫기"
        >
          <div
            className="flex h-[85vh] w-[min(520px,100%)] flex-col rounded-2xl border border-white/10 bg-[#0B0C10] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-[15px] font-semibold text-white/90">청소년 보호정책</span>
              <button
                type="button"
                onClick={() => setYouthOpen(false)}
                className="p-2 text-white/60 hover:text-white"
                aria-label="닫기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <pre className="whitespace-pre-wrap font-sans text-[12px] leading-[1.65] text-white/80">
                {YOUTH_PROTECTION_POLICY_KO}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
