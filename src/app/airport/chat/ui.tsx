"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScreenShell } from "@/components/ScreenShell";
import { SurfaceCard } from "@/components/SurfaceCard";
import { ensurePananaIdentity } from "@/lib/pananaApp/identity";
import { fetchMyAccountInfo, type Gender, updateMyAccountInfo } from "@/lib/pananaApp/accountInfo";

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
        "flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-2 text-left transition",
        active ? "bg-white/[0.055]" : "hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-5 w-5 place-items-center rounded-full ring-2 transition",
          active ? "ring-panana-pink bg-panana-pink/10" : "ring-white/25",
        ].join(" ")}
        aria-hidden="true"
      >
        {active ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" stroke="rgba(255,77,167,0.98)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className="text-[14px] font-semibold tracking-[-0.01em] text-white/85">{label}</span>
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
  const [gender, setGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // 로컬 파일 직접 사용: 입국심사중 (2.png, 2_2.mp4)
  const heroImageUrl = "/airport/2.png";
  const heroVideoUrl = "/airport/2_2.mp4";
  const introText = "입국 심사대 앞에 도착하였다. 친절한 입국 심사관을 마주하는데...";
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!heroVideoUrl) return;

    let playAttempted = false;
    const attemptPlay = async () => {
      if (playAttempted) return;
      try {
        await el.play();
        playAttempted = true;
        setVideoReady(true);
      } catch (err) {
        // 재생 실패 시 무시 (자동 재생 정책 등)
        console.debug("Video autoplay failed:", err);
      }
    };

    const onReady = () => {
      setVideoReady(true);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      attemptPlay();
    };
    
    // 여러 이벤트로 빠른 감지
    el.addEventListener("loadeddata", onReady);
    el.addEventListener("canplay", onReady);
    el.addEventListener("canplaythrough", onReady);
    el.addEventListener("loadedmetadata", onReady);
    
    // 동영상 로딩 즉시 시작
    el.load();
    
    // 마운트 직후에도 재생 시도
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    attemptPlay();

    return () => {
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("canplaythrough", onReady);
      el.removeEventListener("loadedmetadata", onReady);
    };
  }, [heroVideoUrl]);

  useEffect(() => {
    if (sp.get("skip") === "1") modal.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const info = await fetchMyAccountInfo();
        if (!alive) return;
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
              {heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={heroImageUrl}
                  alt=""
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
                    heroVideoUrl && videoReady ? "opacity-0" : "opacity-100"
                  }`}
                />
              ) : null}
              
              {heroVideoUrl ? (
                <video
                  ref={videoRef}
                  src={heroVideoUrl}
                  poster={heroImageUrl || undefined}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
                    videoReady ? "opacity-100" : "opacity-0"
                  }`}
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="auto"
                />
              ) : null}
              
              {!heroImageUrl && !heroVideoUrl ? (
                <div className="grid h-full w-full place-items-center text-[12px] font-semibold text-white/35">미디어가 아직 없어요</div>
              ) : null}
            </div>
          </div>

          <div className="whitespace-pre-line text-center text-[13px] leading-[1.45] text-white/60">
            {introText}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
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

            <div className="mt-3 space-y-2">
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
                        <div className="space-y-2">
                          <RadioOptionRow active={gender === "female"} label="여성" onClick={() => setGender("female")} />
                          <RadioOptionRow active={gender === "male"} label="남성" onClick={() => setGender("male")} />
                          <RadioOptionRow active={gender === "both"} label="둘 다" onClick={() => setGender("both")} />
                          <RadioOptionRow active={gender === "private"} label="공개 안 함" onClick={() => setGender("private")} />
                        </div>
                        <div className="mt-8">
                          <div className="text-center text-[10px] font-semibold text-white/40">생년월일은 8자리 숫자로 입력해 주세요 (YYYYMMDD)</div>
                          <input
                            value={birth}
                            onChange={(e) => setBirth(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
                            inputMode="numeric"
                            className="mt-2 w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-center text-[15px] font-semibold text-white/90 outline-none placeholder:text-white/25"
                            placeholder="YYYYMMDD"
                          />
                        </div>
                        </>
                      )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as any) : s))}
                className="w-full rounded-2xl bg-white px-4 py-3 text-center text-[14px] font-semibold text-black disabled:opacity-60"
                disabled={step === 1 || saving}
              >
                이전
              </button>
              <button
                type="button"
                disabled={
                  saving ||
                  (step === 1
                    ? !purpose
                    : step === 2
                      ? !mood
                      : step === 3
                        ? !characterType
                        : birth.length !== 8 || !gender)
                }
                onClick={async () => {
                  if (step < 4) {
                    setStep((s) => ((s + 1) as any));
                    return;
                  }
                  if (!gender) return;

                  setSaving(true);
                  try {
                    const idt = ensurePananaIdentity();
                    const pananaId = String(idt.id || "").trim();

                    // Step4: 마이페이지 계정설정과 동일 데이터로 저장
                    await updateMyAccountInfo({ birth, gender });
                    try {
                      localStorage.setItem("panana_user_gender", gender);
                    } catch {}

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
                className="w-full rounded-2xl bg-panana-pink px-4 py-3 text-center text-[14px] font-semibold text-white disabled:opacity-40"
              >
                {saving ? "저장 중..." : "다음"}
              </button>
            </div>
          </div>
        </div>
      </ScreenShell>

      {modal.isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div className="absolute inset-0 grid place-items-center px-3">
            <SurfaceCard variant="outglow" className="w-[min(420px,calc(100vw-24px))] p-6">
              <div className="text-center text-[16px] font-semibold text-white/90">입국 심사 건너뛰기</div>
              <div className="mt-4 whitespace-pre-line text-center text-[14px] leading-[1.45] text-white/70">
                입국 심사를 건너뛰면 나에게 맞는
                {"\n"}
                캐릭터들을 못 만날 수 있어요.
                {"\n"}
                그래도 건너뛸까요?
              </div>
              <div className="mt-6 flex gap-4">
                <Link
                  href="/airport/complete"
                  className="flex-1 basis-0 whitespace-nowrap rounded-xl bg-white px-4 py-3 text-center text-[15px] font-semibold text-[#0B0C10]"
                >
                  건너뛰기
                </Link>
                <button
                  type="button"
                  onClick={modal.close}
                  className="flex-1 basis-0 whitespace-nowrap rounded-xl bg-panana-pink px-4 py-3 text-center text-[15px] font-semibold text-white"
                >
                  이어하기
                </button>
              </div>
            </SurfaceCard>
          </div>
        </div>
      ) : null}
    </>
  );
}

