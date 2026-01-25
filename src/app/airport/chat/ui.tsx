"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertModal } from "@/components/AlertModal";
import { ScreenShell } from "@/components/ScreenShell";
import { ensurePananaIdentity } from "@/lib/pananaApp/identity";
import { fetchMyAccountInfo, type Gender, updateMyAccountInfo } from "@/lib/pananaApp/accountInfo";
import { fetchAirportCopy, fetchAirportThumbnailSets, publicUrlFromStoragePath } from "@/lib/pananaApp/airportPublic";

function useModalQuery(key: string) {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const isOpen = sp.get(key) === "1";

  const open = () => {
    const next = new URLSearchParams(sp.toString());
    next.set(key, "1");
    router.push(`${pathname}?${next.toString()}`);
  };

  const close = () => {
    const next = new URLSearchParams(sp.toString());
    next.delete(key);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return { isOpen, open, close };
}

type AirportAnswerDraft = {
  purpose: string;
  mood: string;
  characterType: string;
  birth: string;
  gender: Gender;
  updatedAt: number;
};

function saveAirportDraft(draft: AirportAnswerDraft) {
  try {
    localStorage.setItem("panana_airport_draft", JSON.stringify(draft));
  } catch {
    // ignore
  }
}

function RadioOptionRow({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-4 rounded-2xl bg-white/[0.04] px-5 py-5 text-left transition",
        active ? "bg-white/[0.055]" : "hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-7 w-7 place-items-center rounded-full ring-2 transition",
          active ? "ring-panana-pink bg-panana-pink/10" : "ring-white/25",
        ].join(" ")}
        aria-hidden="true"
      >
        {active ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="rgba(255,77,167,0.98)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-white/85">{label}</span>
    </button>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  const items: Array<{ k: 1 | 2 | 3 | 4; label: string }> = [
    { k: 1, label: "Step.1" },
    { k: 2, label: "Step.2" },
    { k: 3, label: "Step.3" },
    { k: 4, label: "Step.4" },
  ];
  return (
    <div className="flex items-center justify-between gap-2 px-1 pt-1">
      {items.map((it, idx) => {
        const active = it.k === step;
        const passed = it.k < step;
        return (
          <div key={it.k} className="flex flex-1 items-center gap-2">
            <div className={["text-[14px] font-extrabold", active ? "text-white" : passed ? "text-white/65" : "text-white/35"].join(" ")}>
              {it.label}
            </div>
            {idx < items.length - 1 ? <div className="h-[2px] flex-1 bg-white/10" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function mediaUrlFromPathMaybe(pathOrUrl: string) {
  const v = String(pathOrUrl || "").trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return publicUrlFromStoragePath(v);
}

export function AirportChatClient() {
  const modal = useModalQuery("confirmSkip");
  const sp = useSearchParams();
  const router = useRouter();

  const purposeOptions = useMemo(
    () => [
      { value: "spark", label: "설레는 대화하기" },
      { value: "comfort", label: "편하게 위로받기" },
      { value: "spicy", label: "자극적인 대화 나누기" },
      { value: "real", label: "현실적인 느낌 나누기" },
      { value: "light", label: "가볍게 즐기기" },
    ],
    []
  );

  const moodOptions = useMemo(
    () => [
      { value: "sweet", label: "달달한" },
      { value: "calm", label: "차분한" },
      { value: "playful", label: "장난스러운" },
      { value: "tense", label: "긴장감 있는" },
      { value: "intense", label: "강렬한" },
    ],
    []
  );

  const typeOptions = useMemo(
    () => [
      { value: "gentle", label: "다정한 타입" },
      { value: "care", label: "무심한 듯 챙겨주는 타입" },
      { value: "confident", label: "자신감 넘치는 타입" },
      { value: "mystery", label: "비밀 많은 타입" },
      { value: "cute", label: "귀여운 타입" },
    ],
    []
  );

  const [purpose, setPurpose] = useState("");
  const [mood, setMood] = useState("");
  const [characterType, setCharacterType] = useState("");
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState<Gender>("private");
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [heroImageUrl, setHeroImageUrl] = useState<string>("");
  const [heroVideoUrl, setHeroVideoUrl] = useState<string>("");
  const [introText, setIntroText] = useState<string>("");
  const [heroSets, setHeroSets] = useState<Array<{ imageUrl: string; videoUrl: string }>>([]);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    if (sp.get("skip") === "1") modal.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [chatSets, fallbackSets, copyRows, info] = await Promise.all([
          fetchAirportThumbnailSets("immigration_chat"),
          fetchAirportThumbnailSets("immigration"),
          fetchAirportCopy("immigration_intro"),
          fetchMyAccountInfo(),
        ]);
        if (!alive) return;

        const rawSets = (chatSets && chatSets.length ? chatSets : fallbackSets) || [];
        const normalized = rawSets
          .map((s) => ({
            imageUrl: s.image_path ? mediaUrlFromPathMaybe(s.image_path) : "",
            videoUrl: s.video_path ? mediaUrlFromPathMaybe(s.video_path) : "",
          }))
          .filter((s) => s.imageUrl || s.videoUrl);
        setHeroSets(normalized);
        setHeroIdx(0);

        const first = normalized[0] || { imageUrl: "", videoUrl: "" };
        setHeroImageUrl(first.imageUrl);
        setHeroVideoUrl(first.videoUrl);

        const c = copyRows?.find((r) => String(r.text || "").trim())?.text;
        if (c) setIntroText(String(c));

        if (info?.birth) setBirth(String(info.birth));
        if (info?.gender) setGender(info.gender);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const cur = heroSets[heroIdx];
    if (!cur) return;
    setHeroImageUrl(cur.imageUrl);
    setHeroVideoUrl(cur.videoUrl);
  }, [heroIdx, heroSets]);

  return (
    <>
      <ScreenShell
        title="웰컴 투 파나나 공항"
        titleClassName="text-[#ffa1cc]"
        rightAction={
          <button
            type="button"
            onClick={modal.open}
            className="text-[14px] font-semibold text-white/45"
          >
            건너뛰기
          </button>
        }
      >
        <div className="space-y-4">
          <Stepper step={step} />

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="relative aspect-[16/10] w-full bg-black/20">
              {heroVideoUrl ? (
                <video
                  src={heroVideoUrl}
                  poster={heroImageUrl || undefined}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  loop
                  autoPlay
                  preload="auto"
                />
              ) : heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[12px] font-semibold text-white/35">미디어가 아직 없어요</div>
              )}

              {heroSets.length > 1 ? (
                <button
                  type="button"
                  aria-label="다음 썸네일"
                  onClick={() => setHeroIdx((v) => (heroSets.length ? (v + 1) % heroSets.length : 0))}
                  className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 ring-1 ring-white/15 hover:bg-black/45"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M10 6l6 6-6 6" stroke="rgba(255,255,255,0.8)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          <div className="whitespace-pre-line text-center text-[13px] leading-[1.45] text-white/60">
            {introText || "입국 심사대 앞에 도착하였다. 친절한 입국 심사관을 마주하는데..."}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start gap-3">
              {/* avatar (outside bubble) */}
              <div className="mt-[2px] h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/15 bg-black/30 shrink-0">
                {heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[14px] font-extrabold text-white/60">P</div>
                )}
              </div>

              {/* speech bubble with small left tail */}
              <div className="relative min-w-0">
                <span
                  aria-hidden="true"
                  className="absolute bottom-[6px] left-[14px] h-3 w-3 -translate-x-1/2 rotate-45 bg-[#1B1D26]"
                />
                <div className="rounded-[22px] rounded-bl-[10px] bg-[#1B1D26] px-4 py-3 text-[15px] font-semibold tracking-[-0.01em] text-white/85">
                  {step === 1
                    ? "이번 여행의 목적은 무엇인가요?"
                    : step === 2
                      ? "선호하는 분위기를 골라주세요."
                      : step === 3
                        ? "가장 끌리는 캐릭터는?"
                        : "성별과 생년월일은?"}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {step === 1
                ? purposeOptions.map((o) => (
                    <RadioOptionRow key={o.value} active={purpose === o.value} label={o.label} onClick={() => setPurpose(o.value)} />
                  ))
                : step === 2
                  ? moodOptions.map((o) => (
                      <RadioOptionRow key={o.value} active={mood === o.value} label={o.label} onClick={() => setMood(o.value)} />
                    ))
                  : step === 3
                    ? typeOptions.map((o) => (
                        <RadioOptionRow
                          key={o.value}
                          active={characterType === o.value}
                          label={o.label}
                          onClick={() => setCharacterType(o.value)}
                        />
                      ))
                    : (
                        <>
                        <div className="space-y-6">
                          <RadioOptionRow active={gender === "female"} label="여성" onClick={() => setGender("female")} />
                          <RadioOptionRow active={gender === "male"} label="남성" onClick={() => setGender("male")} />
                          <RadioOptionRow active={gender === "both"} label="둘 다" onClick={() => setGender("both")} />
                          <RadioOptionRow active={gender === "private"} label="공개 안 함" onClick={() => setGender("private")} />
                        </div>
                        <div className="mt-8">
                          <div className="text-center text-[11px] font-semibold text-white/40">생년월일은 8자리 숫자로 입력해 주세요 (YYYYMMDD)</div>
                          <input
                            value={birth}
                            onChange={(e) => setBirth(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
                            inputMode="numeric"
                            className="mt-3 w-full rounded-2xl bg-white/[0.04] px-5 py-4 text-center text-[16px] font-semibold text-white/90 outline-none placeholder:text-white/25"
                            placeholder="YYYYMMDD"
                          />
                        </div>
                        </>
                      )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as any) : s))}
                className="w-full rounded-2xl bg-white px-5 py-4 text-center text-[15px] font-semibold text-black disabled:opacity-60"
                disabled={step === 1 || saving}
              >
                이전
              </button>
              <button
                type="button"
                disabled={saving || (step === 1 ? !purpose : step === 2 ? !mood : step === 3 ? !characterType : birth.length !== 8)}
                onClick={async () => {
                  if (step < 4) {
                    setStep((s) => ((s + 1) as any));
                    return;
                  }

                  setSaving(true);
                  try {
                    const idt = ensurePananaIdentity();
                    const pananaId = String(idt.id || "").trim();

                    // Step4: 마이페이지 계정설정과 동일 데이터로 저장
                    await updateMyAccountInfo({ birth, gender });

                    // Step1~3: 공항 응답 저장
                    await fetch("/api/me/airport-response", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ pananaId, purpose, mood, characterType }),
                    }).catch(() => {});

                    saveAirportDraft({ purpose, mood, characterType, birth, gender, updatedAt: Date.now() });
                    router.push("/airport/complete");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="w-full rounded-2xl bg-panana-pink px-5 py-4 text-center text-[15px] font-semibold text-white disabled:opacity-40"
              >
                {saving ? "저장 중..." : "다음"}
              </button>
            </div>
          </div>
        </div>
      </ScreenShell>

      <AlertModal
        open={modal.isOpen}
        message={
          "입국 심사를 건너뛰면 나에게 맞는\n캐릭터들을 못 만날 수 있어요.\n그래도 건너뛸까요?"
        }
        cancelHref="/airport/complete"
        onConfirm={modal.close}
        cancelText="건너뛰기"
        confirmText="이어하기"
      />
    </>
  );
}

