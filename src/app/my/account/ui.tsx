"use client";

import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { useSession } from "next-auth/react";
import { useMemo } from "react";

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 20h9"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4 11.5-11.5z"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AccountClient() {
  const { data: session, status } = useSession();
  const providerLabel = useMemo(() => {
    const p = String((session as any)?.provider || "").toLowerCase();
    if (p === "google") return "구글";
    if (p === "kakao") return "카카오";
    if (p === "naver") return "네이버";
    return p ? p : null;
  }, [session]);
  const accountText = useMemo(() => {
    const email = String((session as any)?.user?.email || "").trim();
    const name = String((session as any)?.user?.name || "").trim();
    return email || name || "";
  }, [session]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title="계정설정" backHref="/my" />

      <main className="mx-auto w-full max-w-[420px] px-0 pb-20 pt-2">
        <div className="border-t border-white/10">
          {/* 내 정보 */}
          <div className="px-5 py-5">
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-extrabold text-white/85">내 정보</div>
              <Link href="/my/account/edit" aria-label="내 정보 편집" className="p-2">
                <PencilIcon />
              </Link>
            </div>
            <div className="mt-2 text-[11px] font-semibold text-white/35">
              캐릭터 추천에 도움이 되어! 정보는 안전하게 보관돼요!
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-5">
            <div className="text-[13px] font-semibold text-white/70">생년월일</div>
            <div className="text-[13px] font-semibold text-white/60">2000년 1월 1일</div>
          </div>
          <div className="flex items-center justify-between px-5 py-5">
            <div className="text-[13px] font-semibold text-white/70">성별</div>
            <div className="text-[13px] font-semibold text-white/60">남성</div>
          </div>

          <div className="border-t border-white/10" />

          {/* 로그인 정보 */}
          <div className="px-5 py-5">
            <div className="text-[13px] font-extrabold text-white/85">로그인 정보</div>
            <div className="mt-2 text-[11px] font-semibold text-white/35">
              {status === "authenticated" && providerLabel ? `${providerLabel} 계정으로 로그인했어요.` : "로그인 정보가 없어요."}
            </div>
            <div className="mt-2 text-[12px] font-semibold text-white/25">{status === "authenticated" ? accountText || "—" : "—"}</div>
          </div>

          <div className="border-t border-white/10" />
        </div>

        <div className="mt-14 px-5">
          <button type="button" className="text-[13px] font-semibold text-white/40">
            회원탈퇴
          </button>
        </div>
      </main>
    </div>
  );
}

