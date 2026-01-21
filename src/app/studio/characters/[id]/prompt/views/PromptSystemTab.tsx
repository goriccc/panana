"use client";

import { useMemo } from "react";
import { useStudioStore } from "@/lib/studio/store";
import { cn } from "@/lib/utils/cn";
import { useFieldArray, useForm } from "react-hook-form";

type FormValues = {
  personalitySummary: string;
  speechGuide: string;
  coreDesire: string;
  fewShotPairs: Array<{ id: string; user: string; bot: string }>;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-extrabold text-white/65">{children}</div>;
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[13px] font-semibold text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
    />
  );
}

function ChatRow({
  role,
  value,
  onChange,
  onDelete,
}: {
  role: "user" | "bot";
  value: string;
  onChange: (v: string) => void;
  onDelete?: () => void;
}) {
  const isUser = role === "user";
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
        <span className="text-[11px] font-extrabold text-white/70">{isUser ? "U" : "B"}</span>
      </div>
      <div className="flex-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isUser ? "User 입력: ..." : "Bot 출력: ..."}
          className={cn(
            "w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px] font-semibold text-white/85 placeholder:text-white/25 outline-none focus:border-white/20",
            isUser ? "" : "bg-white/[0.03]"
          )}
        />
      </div>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] font-extrabold text-white/55 ring-1 ring-white/10 hover:bg-white/[0.05]"
        >
          삭제
        </button>
      ) : null}
    </div>
  );
}

export function PromptSystemTab({ characterId }: { characterId: string }) {
  const prompt = useStudioStore((s) => s.getPrompt(characterId));
  const setPrompt = useStudioStore((s) => s.setPrompt);

  const defaultValues = useMemo<FormValues>(
    () => ({
      personalitySummary: prompt.system.personalitySummary,
      speechGuide: prompt.system.speechGuide,
      coreDesire: prompt.system.coreDesire,
      fewShotPairs: prompt.system.fewShotPairs,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [characterId]
  );

  const form = useForm<FormValues>({ defaultValues, mode: "onChange" });
  const { watch, setValue } = form;
  const fs = useFieldArray({ control: form.control, name: "fewShotPairs", keyName: "_key" });

  const values = watch();

  const persist = () => {
    const next = useStudioStore.getState().getPrompt(characterId);
    setPrompt(characterId, {
      ...next,
      system: {
        ...next.system,
        personalitySummary: values.personalitySummary,
        speechGuide: values.speechGuide,
        coreDesire: values.coreDesire,
        fewShotPairs: values.fewShotPairs,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-[13px] font-extrabold text-white/80">1. 정체성 및 핵심 설정</div>

      <div>
        <FieldLabel>성격 요약 (내용물):</FieldLabel>
        <Textarea
          value={values.personalitySummary}
          onChange={(v) => {
            setValue("personalitySummary", v);
            persist();
          }}
          placeholder="캐릭터의 성격, 가치관, 핵심 동기 등을 요약"
          rows={4}
        />
      </div>

      <div>
        <FieldLabel>말투 가이드:</FieldLabel>
        <Textarea
          value={values.speechGuide}
          onChange={(v) => {
            setValue("speechGuide", v);
            persist();
          }}
          placeholder="말투, 호칭, 금지 표현 등"
          rows={3}
        />
      </div>

      <div>
        <FieldLabel>핵심 욕망:</FieldLabel>
        <Textarea
          value={values.coreDesire}
          onChange={(v) => {
            setValue("coreDesire", v);
            persist();
          }}
          placeholder="캐릭터가 추구하는 목표/욕망"
          rows={3}
        />
      </div>

      <div className="pt-2">
        <div className="text-[13px] font-extrabold text-white/80">
          2. Few-shot 대화 예시 <span className="text-[#ff4da7]">(필수)</span>
        </div>
        <div className="mt-3 space-y-3">
          {fs.fields.map((field, idx) => (
            <div key={field._key} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <ChatRow
                role="user"
                value={values.fewShotPairs[idx]?.user ?? ""}
                onChange={(v) => {
                  setValue(`fewShotPairs.${idx}.user`, v);
                  persist();
                }}
              />
              <div className="mt-3" />
              <ChatRow
                role="bot"
                value={values.fewShotPairs[idx]?.bot ?? ""}
                onChange={(v) => {
                  setValue(`fewShotPairs.${idx}.bot`, v);
                  persist();
                }}
                onDelete={() => {
                  fs.remove(idx);
                  persist();
                }}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              fs.append({ id: `fs-${Date.now()}`, user: "", bot: "" });
              persist();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-3 text-[12px] font-extrabold text-white/55 hover:bg-white/[0.03]"
          >
            + 대화쌍 추가하기
          </button>
        </div>
      </div>
    </div>
  );
}

