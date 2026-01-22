"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { signIn } from "next-auth/react";

export function LoginClient({ returnTo }: { returnTo: string }) {
  const backHref = useMemo(() => returnTo || "/my", [returnTo]);

  const login = async (provider: "kakao" | "naver" | "google") => {
    // Auth.js(NextAuth) OAuth 로그인
    await signIn(provider, { callbackUrl: backHref });
  };

  return (
    <div className="min-h-dvh bg-[linear-gradient(#07070B,#0B0C10)] text-white">
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <div className="mx-auto text-[16px] font-semibold tracking-[-0.01em] text-[#ffa9d6]">로그인</div>
          <Link href={backHref} aria-label="닫기" className="absolute right-0 p-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="rgba(255,255,255,0.75)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[420px] px-5 pb-20 pt-2">
        <div className="text-center">
          <Image
            src="/panana.png"
            alt="Panana"
            width={264}
            height={77}
            priority
            className="mx-auto h-auto w-[220px]"
          />
        </div>

        <div className="mt-48 text-center">
          <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M7 11V8a5 5 0 0110 0v3"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M6 11h12v8H6v-8z"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="mt-4 text-[14px] font-extrabold text-white/85">환영합니다</div>
          <div className="mt-2 text-[12px] font-semibold text-white/45">
            로그인하면 더욱 다양한 혜택을 만날 수 있어요!
          </div>
        </div>

        <div className="mt-10 space-y-3">
          <button
            type="button"
            onClick={() => login("kakao")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-5 py-4 text-[14px] font-extrabold text-black"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center">
              <Image src="/kakao.png" alt="카카오" width={20} height={20} className="h-5 w-5" />
            </span>
            카카오로 시작하기
          </button>

          <button
            type="button"
            onClick={() => login("naver")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#03C75A] px-5 py-4 text-[14px] font-extrabold text-white"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center">
              <Image src="/naver.png" alt="네이버" width={20} height={20} className="h-5 w-5" />
            </span>
            네이버로 시작하기
          </button>

          <button
            type="button"
            onClick={() => login("google")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-4 text-[14px] font-extrabold text-[#111]"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center">
              <Image src="/google.png" alt="구글" width={20} height={20} className="h-5 w-5" />
            </span>
            Google로 시작하기
          </button>

          <button type="button" className="mt-2 block w-full text-center text-[12px] font-semibold text-panana-pink">
            아이디/비밀번호 찾기
          </button>
        </div>
      </main>
    </div>
  );
}

