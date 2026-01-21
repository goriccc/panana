"use client";

import Image from "next/image";

export function LoginModal({
  open,
  onClose,
  onLogin,
}: {
  open: boolean;
  onClose: () => void;
  onLogin: (provider: "kakao" | "naver" | "google") => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      <div className="absolute inset-0 px-5 pt-8">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="relative mb-5">
            <div className="text-center text-[16px] font-semibold text-[#ffa9d6]">로그인</div>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="absolute right-0 top-0 p-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="text-center">
            <Image
              src="/panana.png"
              alt="Panana"
              width={240}
              height={70}
              priority
              className="mx-auto h-auto w-[200px]"
            />
          </div>

          <div className="mt-20 text-center">
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
              onClick={() => onLogin("kakao")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-5 py-4 text-[14px] font-extrabold text-black"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-black/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h16v10H9l-5 4V6z" fill="rgba(0,0,0,0.7)" />
                </svg>
              </span>
              카카오로 시작하기
            </button>

            <button
              type="button"
              onClick={() => onLogin("naver")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#03C75A] px-5 py-4 text-[14px] font-extrabold text-white"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white/15 font-black">
                N
              </span>
              네이버로 시작하기
            </button>

            <button
              type="button"
              onClick={() => onLogin("google")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-4 text-[14px] font-extrabold text-[#111]"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.657 32.657 29.146 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 19.015 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.354 4.337-17.694 10.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.047 0 9.748-1.934 13.238-5.082l-6.117-5.178C29.043 35.091 26.671 36 24 36c-5.123 0-9.624-3.323-11.271-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.218-2.354 4.091-4.404 5.312l.003-.002 6.117 5.178C36.586 38.837 44 34 44 24c0-1.341-.138-2.651-.389-3.917z"/>
                </svg>
              </span>
              Google로 시작하기
            </button>

            <button type="button" className="mt-2 block w-full text-center text-[12px] font-semibold text-panana-pink">
              아이디/비밀번호 찾기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

