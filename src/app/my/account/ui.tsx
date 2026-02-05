"use client";

import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { fetchMyAccountInfo, prefetchMyAccountInfo, type Gender } from "@/lib/pananaApp/accountInfo";
import { ensurePananaIdentity } from "@/lib/pananaApp/identity";

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
  const [birth, setBirth] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [profileNote, setProfileNote] = useState("");
  const [profileNoteSaving, setProfileNoteSaving] = useState(false);
  const [profileNoteStatus, setProfileNoteStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const info = await fetchMyAccountInfo();
      if (!alive || !info) return;
      setBirth(info.birth);
      setGender(info.gender);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const idt = ensurePananaIdentity();
        const pananaId = String(idt?.id || "").trim();
        if (!pananaId) return;
        const qs = pananaId ? `?pananaId=${encodeURIComponent(pananaId)}` : "";
        const res = await fetch(`/api/me/profile-note${qs}`);
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (data?.ok && data.profileNote != null) setProfileNote(String(data.profileNote));
      } catch {
        if (alive) setProfileNote("");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const birthText = useMemo(() => {
    const v = String(birth || "");
    if (v.length !== 8) return "—";
    const y = v.slice(0, 4);
    const m = v.slice(4, 6);
    const d = v.slice(6, 8);
    return `${y}년 ${Number(m)}월 ${Number(d)}일`;
  }, [birth]);

  const genderText = useMemo(() => {
    if (!gender) return "—";
    if (gender === "female") return "여성";
    if (gender === "male") return "남성";
    if (gender === "both") return "둘 다";
    return "공개 안 함";
  }, [gender]);

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
    const pid = String((session as any)?.providerAccountId || "").trim();
    // 이메일이 없으면(카카오/네이버 등) 이름 → provider 계정ID 순으로 fallback
    return email || name || (pid ? `ID: ${pid}` : "");
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
              <Link
                href="/my/account/edit"
                aria-label="내 정보 편집"
                className="p-2"
                prefetch={true}
                onMouseEnter={() => prefetchMyAccountInfo()}
              >
                <PencilIcon />
              </Link>
            </div>
            <div className="mt-2 text-[11px] font-semibold text-white/35">
              캐릭터 추천에 도움이 되어! 정보는 안전하게 보관돼요!
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-5">
            <div className="text-[13px] font-semibold text-white/70">생년월일</div>
            <div className="text-[13px] font-semibold text-white/60">{birthText}</div>
          </div>
          <div className="flex items-center justify-between px-5 py-5">
            <div className="text-[13px] font-semibold text-white/70">성별</div>
            <div className="text-[13px] font-semibold text-white/60">{genderText}</div>
          </div>

          <div className="border-t border-white/10" />

          {/* 캐릭터가 기억할 나에 대한 정보 */}
          <div className="px-5 py-5">
            <div className="text-[13px] font-extrabold text-white/85">캐릭터가 기억할 나에 대한 정보</div>
            <div className="mt-2 text-[11px] font-semibold text-white/35">
              대화할 때 캐릭터가 참고할 수 있어요. (이름, 좋아하는 것, 상황 등 자유롭게 적어 주세요.)
            </div>
            <textarea
              value={profileNote}
              onChange={(e) => setProfileNote(e.target.value)}
              placeholder="예: 나는 민수야. 커피를 좋아해."
              rows={3}
              className="mt-3 w-full resize-y rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-white/85 outline-none placeholder:text-white/25"
              aria-label="캐릭터가 기억할 나에 대한 정보"
            />
            {profileNoteStatus ? (
              <div className="mt-2 text-[12px] font-semibold text-white/60">{profileNoteStatus}</div>
            ) : null}
            <button
              type="button"
              disabled={profileNoteSaving}
              onClick={async () => {
                setProfileNoteStatus(null);
                setProfileNoteSaving(true);
                try {
                  const idt = ensurePananaIdentity();
                  const pananaId = String(idt?.id || "").trim();
                  const res = await fetch("/api/me/profile-note", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ pananaId: pananaId || undefined, profileNote: profileNote.trim() || null }),
                  });
                  const data = await res.json().catch(() => null);
                  if (data?.ok) setProfileNoteStatus("저장됐어요.");
                  else setProfileNoteStatus(data?.error || "저장에 실패했어요.");
                } catch {
                  setProfileNoteStatus("저장에 실패했어요.");
                } finally {
                  setProfileNoteSaving(false);
                }
              }}
              className="mt-2 rounded-xl border border-panana-pink/50 bg-panana-pink/20 px-4 py-2 text-[12px] font-bold text-white/90 hover:bg-panana-pink/30 disabled:opacity-50"
            >
              {profileNoteSaving ? "저장 중..." : "저장"}
            </button>
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

