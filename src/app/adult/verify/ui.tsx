"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScreenShell } from "@/components/ScreenShell";
import { calcAgeFromBirth, fetchAdultStatus, verifyAdult } from "@/lib/pananaApp/adultVerification";

export function AdultVerifyClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sp.get("return") || "/home";
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adultVerified, setAdultVerified] = useState(false);
  const [birth, setBirth] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const status = await fetchAdultStatus();
      if (!alive) return;
      setAdultVerified(Boolean(status?.adultVerified));
      setBirth(status?.birth || null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (adultVerified) {
      try {
        localStorage.setItem("panana_safety_on", "1");
      } catch {}
      router.replace(returnTo);
    }
  }, [adultVerified, returnTo, router]);

  const age = useMemo(() => calcAgeFromBirth(birth), [birth]);
  const canVerify = age != null && age >= 19;

  return (
    <ScreenShell title="성인 인증">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="text-[14px] font-extrabold text-white/85">스파이시 콘텐츠 이용</div>
        <div className="mt-2 whitespace-pre-line text-[12px] font-semibold text-white/55">
          성인 인증을 완료하면 스파이시(NSFW) 캐릭터를 이용할 수 있어요.
          {"\n"}인증 정보는 정책에 따라 안전하게 관리됩니다.
        </div>

        {loading ? (
          <div className="mt-5 text-[12px] font-semibold text-white/45">확인 중...</div>
        ) : adultVerified ? (
          <div className="mt-5 rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-3 text-[13px] font-semibold text-[#6ee7b7]">
            성인 인증이 완료되었습니다.
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[12px] font-semibold text-white/55">
              {birth ? `등록된 생년월일: ${birth}` : "생년월일이 등록되어 있지 않습니다."}
            </div>
            {age != null ? (
              <div className="mt-2 text-[12px] font-semibold text-white/45">만 나이: {age}세</div>
            ) : null}

            {err ? (
              <div className="mt-4 rounded-xl border border-[#ff3d4a]/30 bg-[#ff3d4a]/10 px-4 py-3 text-[13px] font-semibold text-[#ff6b75]">
                {err}
              </div>
            ) : null}

            <button
              type="button"
              disabled={verifying || !canVerify}
              onClick={async () => {
                setErr(null);
                setVerifying(true);
              const res = await verifyAdult();
              if (!res.ok) {
                setErr(res.error);
                setVerifying(false);
                return;
              }
              setAdultVerified(true);
              setVerifying(false);
              }}
              className={`mt-5 w-full rounded-2xl px-5 py-4 text-center text-[14px] font-extrabold ${
                verifying || !canVerify
                  ? "bg-white/10 text-white/40"
                  : "bg-panana-pink text-white"
              }`}
            >
              {verifying ? "인증 중..." : "성인 인증 완료"}
            </button>
            {!canVerify ? (
              <div className="mt-3 text-center text-[11px] font-semibold text-white/40">
                만 19세 이상만 이용할 수 있어요.
              </div>
            ) : null}
          </>
        )}
      </div>

      {!adultVerified ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-[13px] font-semibold text-white/70"
          >
            돌아가기
          </button>
        </div>
      ) : null}
    </ScreenShell>
  );
}
