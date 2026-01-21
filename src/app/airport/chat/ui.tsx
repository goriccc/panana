"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertModal } from "@/components/AlertModal";
import { ChatBubble } from "@/components/ChatBubble";
import { PananaLogo } from "@/components/PananaLogo";
import { ScreenShell } from "@/components/ScreenShell";

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
  updatedAt: number;
};

function saveAirportDraft(draft: AirportAnswerDraft) {
  try {
    localStorage.setItem("panana_airport_draft", JSON.stringify(draft));
  } catch {
    // ignore
  }
}

function OptionPills({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`w-full rounded-2xl border px-4 py-4 text-left text-[14px] font-semibold outline-none transition ${
              active
                ? "border-panana-pink/60 bg-panana-pink/15 text-white"
                : "border-white/10 bg-white/[0.03] text-white/85 hover:bg-white/[0.05]"
            }`}
          >
            {o.label}
          </button>
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
      { value: "spark", label: "설레는 대화" },
      { value: "comfort", label: "편하게 위로받고 싶어요" },
      { value: "spicy", label: "자극적인 대화" },
      { value: "real", label: "현실감 있는 관계" },
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

  const [purpose, setPurpose] = useState("");
  const [mood, setMood] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (sp.get("skip") === "1") modal.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="mb-5">
          <PananaLogo className="opacity-95" />
        </div>

        <div className="space-y-3">
          <ChatBubble variant="system">
            환상의 나라 파나나에 오신걸
            <br />
            진심으로 환영합니다.
            <br />
            간단한 입국 심사를 진행할게요!
          </ChatBubble>

          {step === 1 ? (
            <>
              <ChatBubble variant="system">Q. 이번 여행의 목적은 무엇인가요?</ChatBubble>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <OptionPills
                  value={purpose}
                  onChange={(v) => {
                    setPurpose(v);
                    setStep(2);
                  }}
                  options={purposeOptions}
                />
              </div>
            </>
          ) : (
            <>
              <ChatBubble variant="system">Q. 선호하는 분위기를 골라주세요.</ChatBubble>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <OptionPills value={mood} onChange={setMood} options={moodOptions} />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full rounded-xl bg-white px-5 py-4 text-center text-[15px] font-semibold text-black"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    disabled={!mood}
                    onClick={() => {
                      // TODO(DB): 선택값 저장 후, 태그 기반으로 캐릭터 노출
                      saveAirportDraft({ purpose, mood, updatedAt: Date.now() });
                      router.push("/airport/complete");
                    }}
                    className="w-full rounded-xl bg-panana-pink px-5 py-4 text-center text-[15px] font-semibold text-white disabled:opacity-40"
                  >
                    완료
                  </button>
                </div>
              </div>
            </>
          )}
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

