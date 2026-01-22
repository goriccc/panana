"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-white/5 bg-black/10 px-5 pb-10 pt-8 text-white/35">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="text-[13px] font-semibold text-white/45">Panana.co.ltd</div>
        <div className="mt-3 space-y-1 text-[11px] leading-[1.6]">
          <div>제휴문의: 000-0000-0000</div>
          <div>상담문의: 000-0000-0000</div>
          <div>주소: 대한민국</div>
          <div>이메일: hello@panana.co</div>
        </div>
        <div className="mt-4 text-[11px] text-white/25">© {new Date().getFullYear()} Panana. All rights reserved.</div>
      </div>
    </footer>
  );
}