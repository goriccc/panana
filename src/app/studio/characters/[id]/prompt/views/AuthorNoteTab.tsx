"use client";

import { useMemo } from "react";
import { useStudioStore } from "@/lib/studio/store";

function FieldRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/15 px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[#4F7CFF]"
      />
      <div className="min-w-0">
        <div className="text-[13px] font-extrabold text-white/80">{label}</div>
        {hint ? <div className="mt-1 text-[12px] font-semibold text-white/40">{hint}</div> : null}
      </div>
    </label>
  );
}

export function AuthorNoteTab({ characterId }: { characterId: string }) {
  const prompt = useStudioStore((s) => s.getPrompt(characterId));
  const setPrompt = useStudioStore((s) => s.setPrompt);

  const author = prompt.author;
  const persist = (nextAuthor: typeof author) => {
    const next = useStudioStore.getState().getPrompt(characterId);
    setPrompt(characterId, { ...next, author: nextAuthor });
  };

  const tip = useMemo(() => "Tip: 이 내용은 대화 마지막에 주입되어 AI의 행동을 강제합니다.", []);

  return (
    <div className="space-y-6">
      <div className="text-[16px] font-extrabold tracking-[-0.01em] text-white/90">
        오서 노트 및 형식 제어 (Author Note &amp; Formatting Control)
      </div>

      <div>
        <div className="text-[13px] font-extrabold text-white/80">1. 출력 형식 제어 (Formatting Controls)</div>
        <div className="mt-3 space-y-3">
          <FieldRow
            checked={author.forceBracketNarration}
            onChange={(v) => persist({ ...author, forceBracketNarration: v })}
            label="괄호() 지문 사용 강제** (행동 묘사는 괄호 안에 서술)"
            hint="예: (검을 뽑으며) 누구냐!"
          />
          <FieldRow
            checked={author.shortLongLimit}
            onChange={(v) => persist({ ...author, shortLongLimit: v })}
            label="답변 길이 제한 (Short/Long)"
          />
          <FieldRow
            checked={author.nsfwFilterOff}
            onChange={(v) => persist({ ...author, nsfwFilterOff: v })}
            label="NSFW 필터 해제 (성인 전용)"
          />
        </div>
      </div>

      <div>
        <div className="text-[13px] font-extrabold text-white/80">2. 오서 노트 입력 (Author Note Injection)</div>
        <textarea
          value={author.authorNote}
          onChange={(e) => persist({ ...author, authorNote: e.target.value })}
          rows={8}
          className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[13px] font-semibold text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
          placeholder="최종 지시사항을 입력하세요"
        />
        <div className="mt-2 text-[12px] font-semibold text-white/35">{tip}</div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-xl bg-white/[0.06] px-4 py-3 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
            onClick={() => alert("저장(더미) 완료")}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

