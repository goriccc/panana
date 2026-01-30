"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SurfaceCard } from "@/components/SurfaceCard";
import { myPageDummy } from "@/lib/myPage";
import { fetchMyUserProfile } from "@/lib/pananaApp/userProfiles";
import { ensurePananaIdentity, isValidPananaHandle } from "@/lib/pananaApp/identity";
import { prefetchMyAccountInfo } from "@/lib/pananaApp/accountInfo";
import { signOut, useSession } from "next-auth/react";

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

function BananaIcon() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center">
      <Image src="/pana.png" alt="" width={24} height={24} className="h-6 w-6" />
    </span>
  );
}

function LogoutModal({
  open,
  onClose,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="absolute inset-0 grid place-items-center px-6">
        <SurfaceCard variant="outglow" className="w-full max-w-[520px] p-6">
          <div className="text-center text-[16px] font-semibold text-white/90">알림</div>
          <div className="mt-4 whitespace-pre-line text-center text-[14px] leading-[1.45] text-white/70">
            정말 로그아웃 하시겠습니까?
            {"\n"}
            로그인은 유지하면 더 많은 기능을
            {"\n"}
            이용할 수 있어요!
          </div>

          <div className="mt-6 flex gap-4">
            <button
              type="button"
              onClick={onLogout}
              className="flex-1 basis-0 rounded-xl bg-white px-4 py-3 text-center text-[15px] font-semibold text-[#0B0C10]"
            >
              로그아웃
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 basis-0 rounded-xl bg-panana-pink px-4 py-3 text-center text-[15px] font-semibold text-white"
            >
              머무르기
            </button>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-[18px] font-bold text-white/90">{value.toLocaleString("ko-KR")}</div>
      <div className="mt-1 text-[11px] font-semibold text-white/40">{label}</div>
    </div>
  );
}

export function MyPageClient() {
  const router = useRouter();
  const data = useMemo(() => myPageDummy, []);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const localIdt = useMemo(() => ensurePananaIdentity(), []);
  // UX: 초기 렌더에서 더미 대신 로컬/세션 값을 즉시 표시하고, 이후 DB 값으로 보정한다.
  const [nickname, setNickname] = useState<string>(() => String(localIdt.nickname || "").trim());
  const [pananaHandle, setPananaHandle] = useState<string>(() => String(localIdt.handle || "").trim().toLowerCase());
  const { data: session, status } = useSession();
  const loggedIn = status === "authenticated";
  const isMember = Boolean((session as any)?.membershipActive);

  // 마이페이지 진입 시 주요 링크 프리페칭
  useEffect(() => {
    const prefetchLinks = [
      "/my/notices",
      "/my/notifications",
      "/my/reset",
      "/my/account",
      "/my/edit",
      "/login",
    ];
    prefetchLinks.forEach((href) => {
      router.prefetch(href);
    });
  }, [router]);
  
  // 세션 데이터를 즉시 활용하여 초기 렌더링 속도 개선
  useEffect(() => {
    if (status === "authenticated" && session) {
      const pn = String((session as any)?.pananaNickname || "").trim();
      const snick = String((session as any)?.nickname || "").trim();
      const sname = String((session as any)?.user?.name || "").trim();
      const quick = pn || snick || sname;
      if (quick && !nickname) setNickname(quick);
    }
  }, [status, session, nickname]);
  const avatarUrl = useMemo(() => {
    const custom = String((session as any)?.profileImageUrl || "").trim();
    const providerImg = String((session as any)?.user?.image || "").trim();
    return custom || providerImg || "";
  }, [session]);

  useEffect(() => {
    const idt = ensurePananaIdentity();
    const sHandle = String((session as any)?.pananaHandle || "").trim().toLowerCase();
    const handle = isValidPananaHandle(sHandle) ? sHandle : isValidPananaHandle(idt.handle) ? idt.handle : "";
    setPananaHandle(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  useEffect(() => {
    // 세션이 늦게 로딩될 수 있으니, 들어오는 즉시 UI를 먼저 갱신한다(네트워크 fetch 전에).
    const pn = String((session as any)?.pananaNickname || "").trim();
    const snick = String((session as any)?.nickname || "").trim();
    const sname = String((session as any)?.user?.name || "").trim();
    const semail = String((session as any)?.user?.email || "").trim();
    const quick = pn || snick || sname || semail;
    if (quick) setNickname((prev) => (prev ? prev : quick));
  }, [session, status]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      // 병렬로 세션과 프로필 데이터 확인
      const [p] = await Promise.all([
        fetchMyUserProfile().catch(() => null),
      ]);
      if (!alive) return;
      const nick = String(p?.nickname || "").trim();
      // Supabase 프로필이 없으면 Auth.js 세션 이름/이메일로 fallback
      if (nick) setNickname(nick);
      else {
        const pn = String((session as any)?.pananaNickname || "").trim();
        const snick = String((session as any)?.nickname || "").trim();
        const sname = String((session as any)?.user?.name || "").trim();
        const semail = String((session as any)?.user?.email || "").trim();
        const fallback = pn || snick || sname || semail || String(localIdt.nickname || "").trim();
        if (fallback) setNickname(fallback);
      }
    };
    load();
    const onFocus = () => {
      load();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link href="/home" aria-label="뒤로가기" className="absolute left-0 p-2">
            <BackIcon />
          </Link>
          <div className="mx-auto text-[18px] font-semibold tracking-[-0.01em] text-[#ffa9d6]">
            마이 페이지
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[420px] px-5 pb-16 pt-2">
        <div className="mt-2 border-y border-white/10 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-[58px] w-[58px] overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="프로필 이미지" width={58} height={58} className="h-full w-full object-cover" />
                ) : (
                  <Image
                    src="/dumyprofile.png"
                    alt="기본 프로필 이미지"
                    width={58}
                    height={58}
                    className="h-full w-full object-cover opacity-90"
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-white/85">
                  {nickname ? (
                    nickname
                  ) : (
                    <span className="inline-block h-[14px] w-[110px] animate-pulse rounded bg-white/10 align-middle" aria-hidden="true" />
                  )}
                </div>
                <div className="mt-1 text-[12px] font-semibold text-white/45">
                  {pananaHandle ? (
                    pananaHandle
                  ) : (
                    <span className="inline-block h-[12px] w-[90px] animate-pulse rounded bg-white/10 align-middle" aria-hidden="true" />
                  )}
                </div>
              </div>
            </div>

            <Link 
              href="/my/edit" 
              aria-label="프로필 편집" 
              className="p-2"
              prefetch={true}
              onMouseEnter={() => router.prefetch("/my/edit")}
            >
              <PencilIcon />
            </Link>
          </div>
        </div>

        {loggedIn ? (
          <>
            <div className="mt-6 flex items-center justify-center gap-8">
              <Link 
                href="/my/follows?tab=followers" 
                aria-label="내 팔로워 목록"
                prefetch={true}
                onMouseEnter={() => router.prefetch("/my/follows")}
              >
                <Stat value={data.followers} label="팔로워" />
              </Link>
              <Link 
                href="/my/follows?tab=following" 
                aria-label="내 팔로잉 목록"
                prefetch={true}
                onMouseEnter={() => router.prefetch("/my/follows")}
              >
                <Stat value={data.following} label="팔로잉" />
              </Link>
            </div>

            <div className="mt-6">
              <div className="rounded-2xl bg-[#2f2f3a] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <BananaIcon />
                    <div className="min-w-0 text-[13px] font-semibold text-white/70">
                      {data.bananas.toLocaleString("ko-KR")}
                      <span className="text-[#f29ac3]">개의 파나나를 가지고 있어요</span>
                    </div>
                  </div>
                  <Link
                    href="/my/charge"
                    className="rounded-lg bg-panana-pink px-4 py-2 text-[12px] font-bold text-white"
                    prefetch={true}
                    onMouseEnter={() => router.prefetch("/my/charge")}
                  >
                    충전
                  </Link>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <Link
              href="/login?return=/my"
              className="mt-5 block w-full rounded-2xl bg-panana-pink px-5 py-4 text-center text-[13px] font-extrabold text-white"
              prefetch={true}
              onMouseEnter={() => router.prefetch("/login")}
            >
              로그인하고 더 많은 기능 둘러보기
            </Link>
          </>
        )}

        {loggedIn && !isMember ? (
          <Link
            href="/my/membership"
            className="mt-4 block w-full rounded-xl border border-panana-pink/60 bg-white px-4 py-3 text-center text-[13px] font-bold text-panana-pink"
            prefetch={true}
            onMouseEnter={() => router.prefetch("/my/membership")}
          >
            멤버십 가입하고 무제한 이용하기
          </Link>
        ) : null}

        <div className="mt-8 space-y-6 text-[14px] font-semibold text-white/60">
          <Link 
            href="/my/notices" 
            className="block w-full text-left"
            prefetch={true}
            onMouseEnter={() => router.prefetch("/my/notices")}
          >
            공지사항
          </Link>
          <Link 
            href="/my/notifications" 
            className="block w-full text-left"
            prefetch={true}
            onMouseEnter={() => router.prefetch("/my/notifications")}
          >
            알림설정
          </Link>
          {loggedIn ? (
            <Link
              href="/my/account"
              className="block w-full text-left"
              prefetch={true}
              onMouseEnter={() => {
                router.prefetch("/my/account");
                prefetchMyAccountInfo();
              }}
            >
              계정설정
            </Link>
          ) : null}
          <Link 
            href="/my/reset" 
            className="block w-full text-left"
            prefetch={true}
            onMouseEnter={() => router.prefetch("/my/reset")}
          >
            초기화
          </Link>
        </div>

        {loggedIn ? (
          <button
            type="button"
            className="mt-16 block w-full text-left text-[13px] font-semibold text-white/45"
            onClick={() => setLogoutOpen(true)}
          >
            로그아웃
          </button>
        ) : (
          <Link
            href="/login?return=/my"
            className="mt-16 block w-full text-left text-[13px] font-semibold text-white/45"
            prefetch={true}
            onMouseEnter={() => router.prefetch("/login")}
          >
            로그인
          </Link>
        )}
      </main>

      <LogoutModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onLogout={() => {
          setLogoutOpen(false);
          // Auth.js 로그아웃 후 공항(온보딩)으로 이동
          signOut({ callbackUrl: "/airport" });
        }}
      />
    </div>
  );
}

