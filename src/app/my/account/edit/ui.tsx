"use client";

import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { fetchMyAccountInfo, type Gender, updateMyAccountInfo } from "@/lib/pananaApp/accountInfo";

function RadioRow({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: Gender;
  selected: Gender;
  onSelect: (v: Gender) => void;
}) {
  const active = selected === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="flex w-full items-center gap-3 py-2 text-left"
    >
      <span
        className={[
          "grid h-5 w-5 place-items-center rounded-full ring-2",
          active ? "ring-panana-pink" : "ring-white/30",
        ].join(" ")}
        aria-hidden="true"
      >
        {active ? <span className="h-2.5 w-2.5 rounded-full bg-panana-pink" /> : null}
      </span>
      <span className="text-[13px] font-semibold text-white/80">{label}</span>
    </button>
  );
}

export function AccountEditClient() {
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState<Gender>("private");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const prettyBirth = useMemo(() => {
    const v = String(birth || "");
    if (v.length !== 8) return "";
    const y = v.slice(0, 4);
    const m = v.slice(4, 6);
    const d = v.slice(6, 8);
    return `${y}년 ${Number(m)}월 ${Number(d)}일`;
  }, [birth]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const info = await fetchMyAccountInfo();
      if (!alive || !info) return;
      if (info.birth) setBirth(String(info.birth));
      if (info.gender) setGender(info.gender);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title="내 정보 수정하기" backHref="/my/account" />

      <main className="mx-auto w-full max-w-[420px] px-0 pb-20 pt-2">
        <div className="border-t border-white/10">
          <div className="px-5 py-5">
            <div className="text-[13px] font-extrabold text-white/85">내 정보</div>
            <div className="mt-2 text-[11px] font-semibold text-white/35">
              캐릭터 추천에 도움이 돼요! 정보는 안전하게 보관돼요!
            </div>
            {prettyBirth ? <div className="mt-2 text-[11px] font-semibold text-white/45">현재: {prettyBirth}</div> : null}
            {status ? <div className="mt-2 text-[12px] font-semibold text-[#ff9aa1]">{status}</div> : null}
          </div>

          <div className="border-t border-white/10" />

          <div className="px-5 py-5">
            <div className="flex items-end justify-between gap-4">
              <div className="text-[13px] font-extrabold text-white/85">생년월일</div>
              <div className="text-[11px] font-semibold text-white/35">8자리의 숫자만 입력해 주세요.</div>
            </div>
            <input
              value={birth}
              onChange={(e) => setBirth(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
              inputMode="numeric"
              className="mt-3 w-full rounded-2xl border border-panana-pink/60 bg-white/[0.04] px-5 py-4 text-[14px] font-semibold text-white/85 outline-none placeholder:text-white/25"
              placeholder="YYYYMMDD"
            />
          </div>

          <div className="border-t border-white/10" />

          <div className="px-5 py-5">
            <div className="flex items-end justify-between gap-4">
              <div className="text-[13px] font-extrabold text-white/85">성별</div>
              <div className="text-[11px] font-semibold text-white/35">캐릭터 추천을 위해 꼭 선택해 주세요</div>
            </div>

            <div className="mt-3">
              <RadioRow label="여성" value="female" selected={gender} onSelect={setGender} />
              <RadioRow label="남성" value="male" selected={gender} onSelect={setGender} />
              <RadioRow label="둘 다" value="both" selected={gender} onSelect={setGender} />
              <RadioRow label="공개 안 함" value="private" selected={gender} onSelect={setGender} />
            </div>
          </div>
        </div>

        <div className="px-5">
          <button
            type="button"
            disabled={saving || birth.length !== 8}
            className="mt-10 w-full rounded-2xl bg-panana-pink px-5 py-4 text-[15px] font-extrabold text-white disabled:opacity-50"
            onClick={async () => {
              setStatus(null);
              setSaving(true);
              try {
                const res = await updateMyAccountInfo({ birth, gender });
                if (!res.ok) {
                  setStatus(res.error);
                  return;
                }
                setStatus("저장 완료!");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </main>
    </div>
  );
}

