"use client";

import { useMemo } from "react";
import type { TriggerCondition, TriggerRule, TriggerRulesPayload } from "@/lib/studio/types";
import { cn } from "@/lib/utils/cn";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn("h-7 w-12 rounded-full border border-white/10 p-1", on ? "bg-[#4F7CFF]" : "bg-white/[0.06]")}
    >
      <div className={cn("h-5 w-5 rounded-full bg-white transition-transform", on ? "translate-x-5" : "")} />
    </button>
  );
}

function TagInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-extrabold text-white/75"
        >
          {v}
          <button type="button" className="text-white/45 hover:text-white/80" onClick={() => onChange(values.filter((x) => x !== v))}>
            ×
          </button>
        </span>
      ))}
      <input
        className="min-w-[120px] flex-1 bg-transparent text-[12px] font-semibold text-white/80 placeholder:text-white/25 outline-none"
        placeholder="키워드 입력 후 Enter"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const input = e.currentTarget.value.trim();
          if (!input) return;
          onChange(Array.from(new Set([...values, input])));
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function ConditionEditor({ c, onChange }: { c: TriggerCondition; onChange: (next: TriggerCondition) => void }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={c.type}
          onChange={(e) => {
            const t = e.target.value as TriggerCondition["type"];
            if (t === "text_includes") onChange({ type: "text_includes", values: [] });
            else if (t === "inactive_time") onChange({ type: "inactive_time", hours: 24 });
            else onChange({ type: "variable_compare", var: "jealousy", op: "<", value: 50 });
          }}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
        >
          <option value="text_includes">유저입력 텍스트 포함</option>
          <option value="variable_compare">변수 비교</option>
          <option value="inactive_time">미접속 시간</option>
        </select>

        {c.type === "text_includes" ? (
          <div className="min-w-[320px] flex-1">
            <TagInput values={c.values} onChange={(values) => onChange({ ...c, values })} />
          </div>
        ) : null}

        {c.type === "variable_compare" ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={c.var}
              onChange={(e) => onChange({ ...c, var: e.target.value })}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
            >
              <option value="jealousy">질투(jealousy)</option>
              <option value="affection">호감(affection)</option>
            </select>
            <select
              value={c.op}
              onChange={(e) => onChange({ ...c, op: e.target.value as any })}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
            >
              <option value="<">&lt;</option>
              <option value=">">&gt;</option>
              <option value="=">=</option>
            </select>
            <input
              value={c.value}
              onChange={(e) => onChange({ ...c, value: Number(e.target.value) || 0 })}
              className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
            />
          </div>
        ) : null}

        {c.type === "inactive_time" ? (
          <div className="flex items-center gap-2">
            <input
              value={c.hours}
              onChange={(e) => onChange({ ...c, hours: Number(e.target.value) || 0 })}
              className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
            />
            <span className="text-[12px] font-extrabold text-white/45">시간</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/15 p-3">
      <div className="text-[12px] font-extrabold text-white/60">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function TriggerRuleBuilder({
  title,
  subtitle,
  value,
  onChange,
  showJsonPreview = true,
}: {
  title: string;
  subtitle?: string;
  value: TriggerRulesPayload;
  onChange: (next: TriggerRulesPayload) => void;
  showJsonPreview?: boolean;
}) {
  const rules = value.rules;

  const updateRule = (id: string, patch: Partial<TriggerRule>) => {
    onChange({ rules: rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  };

  const jsonPreview = useMemo(() => JSON.stringify({ rules }, null, 2), [rules]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">{title}</div>
          {subtitle ? <div className="mt-1 text-[12px] font-semibold text-white/40">{subtitle}</div> : null}
        </div>
        <button
          type="button"
          className="rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
          onClick={() =>
            onChange({
              rules: [
                ...rules,
                {
                  id: `rule_${Date.now()}`,
                  name: "새 규칙",
                  enabled: true,
                  if: { type: "AND", conditions: [{ type: "text_includes", values: [] }] },
                  then: { actions: [{ type: "system_message", text: "" }] },
                },
              ],
            })
          }
        >
          + 새 규칙 만들기
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {rules.map((r, idx) => (
          <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] font-extrabold text-white/85">
                Rule #{idx + 1}: {r.name}
              </div>
              <div className="flex items-center gap-3">
                <Toggle on={r.enabled} onChange={(v) => updateRule(r.id, { enabled: v })} />
                <button
                  type="button"
                  className="rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] font-extrabold text-white/55 ring-1 ring-white/10 hover:bg-white/[0.05]"
                  onClick={() => onChange({ rules: rules.filter((x) => x.id !== r.id) })}
                >
                  🗑
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_44px_1fr]">
              <div className="rounded-2xl border border-[#4F7CFF]/40 bg-[#0b1326] p-4">
                <div className="mb-3 text-[11px] font-extrabold text-[#8FB1FF]">IF</div>

                <div className="mb-3 flex items-center gap-2">
                  <div className="text-[12px] font-extrabold text-white/55">조건 유형:</div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1">
                    <button
                      type="button"
                      onClick={() => updateRule(r.id, { if: { ...r.if, type: "AND" } })}
                      className={cn(
                        "rounded-lg px-3 py-1 text-[12px] font-extrabold",
                        r.if.type === "AND" ? "bg-white/10 text-white/85" : "text-white/45 hover:text-white/70"
                      )}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRule(r.id, { if: { ...r.if, type: "OR" } })}
                      className={cn(
                        "rounded-lg px-3 py-1 text-[12px] font-extrabold",
                        r.if.type === "OR" ? "bg-white/10 text-white/85" : "text-white/45 hover:text-white/70"
                      )}
                    >
                      OR
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {r.if.conditions.map((c, cIdx) => (
                    <div key={cIdx}>
                      <ConditionEditor
                        c={c}
                        onChange={(nextC) => {
                          const next = { ...r.if, conditions: r.if.conditions.map((x, i) => (i === cIdx ? nextC : x)) };
                          updateRule(r.id, { if: next });
                        }}
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          className="text-[11px] font-extrabold text-white/45 hover:text-white/70"
                          onClick={() => updateRule(r.id, { if: { ...r.if, conditions: r.if.conditions.filter((_, i) => i !== cIdx) } })}
                        >
                          조건 삭제
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-3 text-[12px] font-extrabold text-white/55 hover:bg-white/[0.03]"
                    onClick={() => updateRule(r.id, { if: { ...r.if, conditions: [...r.if.conditions, { type: "text_includes", values: [] }] } })}
                  >
                    + 조건 추가
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center text-white/35">→</div>

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="mb-3 text-[11px] font-extrabold text-white/55">THEN</div>
                <div className="space-y-3">
                  {r.then.actions.map((a, aIdx) => (
                    <div key={aIdx}>
                      {a.type === "variable_mod" ? (
                        <ActionRow label="결과 유형: 변수 값 변경">
                          <select
                            value={a.var}
                            onChange={(e) => updateRule(r.id, { then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, var: e.target.value } as any) : x)) } })}
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
                          >
                            <option value="affection">호감도(affection)</option>
                            <option value="jealousy">질투(jealousy)</option>
                          </select>
                          <select
                            value={a.op}
                            onChange={(e) => updateRule(r.id, { then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, op: e.target.value } as any) : x)) } })}
                            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
                          >
                            <option value="+">+</option>
                            <option value="-">-</option>
                          </select>
                          <input
                            value={a.value}
                            onChange={(e) => updateRule(r.id, { then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, value: Number(e.target.value) || 0 } as any) : x)) } })}
                            className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
                          />
                        </ActionRow>
                      ) : null}

                      {a.type === "system_message" ? (
                        <ActionRow label="결과 유형: 시스템 메시지 출력">
                          <input
                            value={a.text}
                            onChange={(e) => updateRule(r.id, { then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, text: e.target.value } as any) : x)) } })}
                            className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none placeholder:text-white/25"
                            placeholder="[시스템] ... "
                          />
                        </ActionRow>
                      ) : null}

                      {a.type === "status_effect" ? (
                        <ActionRow label="결과 유형: 특수 상태 부여">
                          <input
                            value={a.key}
                            onChange={(e) => updateRule(r.id, { then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, key: e.target.value } as any) : x)) } })}
                            className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none placeholder:text-white/25"
                            placeholder="상태: 집착"
                          />
                          <input
                            value={a.turns}
                            onChange={(e) => updateRule(r.id, { then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, turns: Number(e.target.value) || 0 } as any) : x)) } })}
                            className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
                          />
                          <span className="text-[12px] font-extrabold text-white/45">턴 지속</span>
                        </ActionRow>
                      ) : null}

                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          className="text-[11px] font-extrabold text-white/45 hover:text-white/70"
                          onClick={() => updateRule(r.id, { then: { actions: r.then.actions.filter((_, i) => i !== aIdx) } })}
                        >
                          액션 삭제
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-3 text-[12px] font-extrabold text-white/55 hover:bg-white/[0.03]"
                    onClick={() => updateRule(r.id, { then: { actions: [...r.then.actions, { type: "variable_mod", var: "affection", op: "+", value: 1 }] } })}
                  >
                    + 액션 추가
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showJsonPreview ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="text-[12px] font-extrabold text-white/55">백엔드 전송 JSON (미리보기)</div>
          <pre className="mt-3 max-h-[280px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] font-semibold text-white/70">
{jsonPreview}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

