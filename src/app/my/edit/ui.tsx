"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { myPageDummy } from "@/lib/myPage";
import { fetchMyUserProfile, upsertMyUserNickname } from "@/lib/pananaApp/userProfiles";
import { ensurePananaIdentity, isValidPananaHandle } from "@/lib/pananaApp/identity";
import { useSession } from "next-auth/react";

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
  const localIdt = useMemo(() => ensurePananaIdentity(), []);
  // UX: 편집 화면도 초기엔 로컬 닉네임을 즉시 보여주고, 이후 DB/세션으로 보정
  const [name, setName] = useState(() => String(localIdt.nickname || "").trim());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const { data: session, update } = useSession();
  const [pananaHandle, setPananaHandle] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await fetchMyUserProfile();
      if (!alive) return;
      if (p?.nickname) setName(p.nickname);
      else {
        const pn = String((session as any)?.pananaNickname || "").trim();
        if (pn) setName(pn);
        else {
          const ln = String(localIdt.nickname || "").trim();
          if (ln) setName((prev) => (prev ? prev : ln));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const idt = ensurePananaIdentity();
    const sHandle = String((session as any)?.pananaHandle || "").trim().toLowerCase();
    const handle = isValidPananaHandle(sHandle) ? sHandle : isValidPananaHandle(idt.handle) ? idt.handle : "";
    setPananaHandle(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    // 세션에 저장된 프로필 이미지가 있으면 초기 표시
    const url = String((session as any)?.profileImageUrl || (session as any)?.user?.image || "").trim();
    if (!url) return;
    // blob 미리보기 우선
    if (avatarUrl && avatarUrl.startsWith("blob:")) return;
    setAvatarUrl(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    return () => {
      // blob URL 정리
      if (avatarUrl && avatarUrl.startsWith("blob:")) URL.revokeObjectURL(avatarUrl);
    };
  }, [avatarUrl]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link 
            href="/my" 
            aria-label="뒤로가기" 
            className="absolute left-0 p-2"
            prefetch={true}
          >
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
            {avatarUrl ? (
              avatarUrl.startsWith("blob:") ? (
                // 선택한 로컬 이미지 미리보기(blob URL)
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="프로필 이미지" className="h-full w-full object-cover" />
              ) : (
                <Image src={avatarUrl} alt="프로필 이미지" width={86} height={86} className="h-full w-full object-cover" />
              )
            ) : (
              <Image src="/dumyprofile.png" alt="기본 프로필 이미지" width={86} height={86} className="h-full w-full object-cover" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (!f) return;
              if (!f.type.startsWith("image/")) {
                setStatus("이미지 파일만 선택할 수 있어요.");
                e.currentTarget.value = "";
                return;
              }
              // 너무 큰 파일은 UX상 제한(업로드 기능 붙일 때도 유용)
              if (f.size > 8 * 1024 * 1024) {
                setStatus("이미지는 8MB 이하로 선택해 주세요.");
                e.currentTarget.value = "";
                return;
              }

              setStatus(null);
              // 이전 blob URL 정리
              setAvatarUrl((prev) => {
                if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
                return URL.createObjectURL(f);
              });
              setAvatarFile(f);
              // 같은 파일 재선택도 가능하게
              e.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            className="mt-3 rounded-full bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/70 ring-1 ring-white/10"
            onClick={() => fileRef.current?.click()}
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
            value={pananaHandle || data.handle}
            disabled
            className="mt-3 w-full rounded-2xl bg-white/[0.06] px-5 py-4 text-[14px] font-semibold text-white/35 outline-none"
          />
        </div>

        <button
          type="button"
          disabled={saving}
          className="mt-10 w-full rounded-2xl bg-panana-pink px-5 py-4 text-[15px] font-extrabold text-white disabled:opacity-60"
          onClick={async () => {
            setStatus(null);
            setSaving(true);
            try {
              // 1) 프로필 이미지 업로드(선택된 경우)
              if (avatarFile) {
                const fd = new FormData();
                fd.set("file", avatarFile);
                const res = await fetch("/api/me/profile-image", { method: "POST", body: fd });
                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.ok) {
                  if (res.status === 401) {
                    setStatus("로그인이 필요합니다. 다시 로그인 후 프로필 이미지를 변경해 주세요.");
                    return;
                  }
                  setStatus(String(data?.error || "프로필 이미지 업로드에 실패했어요."));
                  return;
                }
                const publicUrl = String(data.publicUrl || "").trim();
                if (publicUrl) {
                  // 이미지 캐시(브라우저/Next Image) 무효화를 위해 version query 추가
                  const sep = publicUrl.includes("?") ? "&" : "?";
                  const bustUrl = `${publicUrl}${sep}v=${Date.now()}`;
                  await update({ profileImageUrl: bustUrl } as any);
                  setAvatarUrl((prev) => (prev && prev.startsWith("blob:") ? prev : bustUrl));
                }
              }

              const res = await upsertMyUserNickname(name);
              if (!res.ok) {
                const nick = String(name || "").trim().slice(0, 10);
                await update({ pananaNickname: nick, nickname: nick } as any);
                setStatus(res.error || "닉네임 저장에 실패했어요.");
                return;
              }
              // DB 저장 성공 케이스도 마이페이지 즉시 반영을 위해 세션에도 반영
              {
                const nick = String(name || "").trim().slice(0, 10);
                await update({ pananaNickname: nick, nickname: nick } as any);
              }
              setStatus("저장 완료!");
              setAvatarFile(null);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "저장에 실패했어요.";
              setStatus(msg);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "저장 중..." : "저장하기"}
        </button>
        {status ? <div className="mt-3 text-center text-[12px] font-semibold text-white/60">{status}</div> : null}
      </main>
    </div>
  );
}

