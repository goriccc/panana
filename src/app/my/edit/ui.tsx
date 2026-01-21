"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { myPageDummy } from "@/lib/myPage";

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15 6l-6 6 6 6"
        stroke="rgba(255,169,214,0.98)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MyEditClient() {
  const data = useMemo(() => myPageDummy, []);
  const [name, setName] = useState(data.name);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link href="/my" aria-label="뒤로가기" className="absolute left-0 p-2">
            <BackIcon />
          </Link>
          <div className="mx-auto text-[18px] font-semibold tracking-[-0.01em] text-[#ffa9d6]">
            프로필 편집
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[420px] px-5 pb-16 pt-4">
        <div className="flex flex-col items-center">
          <div className="h-[86px] w-[86px] overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            <Image src="/panana.png" alt="" width={86} height={86} className="h-full w-full object-cover opacity-0" />
          </div>
          <button
            type="button"
            className="mt-3 rounded-full bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/70 ring-1 ring-white/10"
          >
            변경하기
          </button>
        </div>

        <div className="mt-8">
          <div className="flex items-end justify-between">
            <div className="text-[13px] font-semibold text-white/85">닉네임</div>
            <div className="text-[11px] font-semibold text-white/35">최대 10글자까지 만들수 있어요.</div>
          </div>
          <input
            value={name}
            maxLength={10}
            onChange={(e) => setName(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-panana-pink/60 bg-white/[0.04] px-5 py-4 text-[14px] font-semibold text-white/85 outline-none placeholder:text-white/25"
          />
        </div>

        <div className="mt-6">
          <div className="text-[13px] font-semibold text-white/85">고유번호</div>
          <div className="mt-1 text-[11px] font-semibold text-white/35">
            회원가입시 부여되는 아이디예요. 변경할 수 없어요.
          </div>
          <input
            value={data.handle}
            disabled
            className="mt-3 w-full rounded-2xl bg-white/[0.06] px-5 py-4 text-[14px] font-semibold text-white/35 outline-none"
          />
        </div>

        <button
          type="button"
          className="mt-10 w-full rounded-2xl bg-panana-pink px-5 py-4 text-[15px] font-extrabold text-white"
        >
          저장하기
        </button>
      </main>
    </div>
  );
}

