"use client";

import { useMemo, useState } from "react";
import { useStudioStore } from "@/lib/studio/store";
import { studioGetCharacter, studioSavePromptPayload } from "@/lib/studio/db";

export function OperatorMemoTab({ characterId }: { characterId: string }) {
  const prompt = useStudioStore((s) => s.getPrompt(characterId));
  const setPrompt = useStudioStore((s) => s.setPrompt);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const memo = prompt.meta?.operatorMemo || "";
  const tip = useMemo(() => "Tip: 이 메모는 작가/운영자가 보는 내부 노트이며, 채팅 프롬프트에 직접 주입하지 않습니다.", []);

  return (
    <div className="space-y-6">
      <div className="text-[16px] font-extrabold tracking-[-0.01em] text-white/90">운영자 메모 (Operator Memo)</div>

      <div>
        <div className="text-[12px] font-semibold text-white/40">
          - 타깃 후킹 포인트 / 과금 피로도 완화 원칙 / EP 운영 계획 등을 기록해두세요.
        </div>
        <textarea
          value={memo}
          onChange={(e) => {
            const next = useStudioStore.getState().getPrompt(characterId);
            setPrompt(characterId, { ...next, meta: { ...(next.meta || {}), operatorMemo: e.target.value } });
          }}
          rows={14}
          className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[13px] font-semibold text-white/85 placeholder:text-white/25 outline-none focus:border-white/20"
          placeholder="운영자 메모를 입력하세요..."
        />
        <div className="mt-2 text-[12px] font-semibold text-white/35">{tip}</div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-xl bg-white/[0.06] px-4 py-3 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08] disabled:opacity-50"
            disabled={saving}
            onClick={async () => {
              setErr(null);
              setSaving(true);
              try {
                const c = await studioGetCharacter(characterId);
                if (!c) throw new Error("캐릭터를 찾을 수 없어요.");
                const current = useStudioStore.getState().getPrompt(characterId);
                await studioSavePromptPayload({
                  projectId: c.project_id,
                  characterId,
                  payload: { system: current.system, author: current.author, meta: current.meta },
                  status: "draft",
                });
              } catch (e: any) {
                setErr(e?.message || "저장에 실패했어요.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
        {err ? <div className="mt-3 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
      </div>
    </div>
  );
}

