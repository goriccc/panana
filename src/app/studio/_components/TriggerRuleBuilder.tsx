"use client";

import { useMemo } from "react";
import type { TriggerCondition, TriggerRule, TriggerRulesPayload } from "@/lib/studio/types";
import { cn } from "@/lib/utils/cn";
import { VarLabelResolutionPreview, type VarLabelScope } from "@/app/studio/_components/VarLabelResolutionPreview";

function normalizeVarKey(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 48);
}

function normalizeVarLabels(input: TriggerRulesPayload["varLabels"]): Record<string, string> {
  const src = input && typeof input === "object" ? input : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    const key = normalizeVarKey(k);
    const label = String(v || "").trim().slice(0, 24);
    if (!key || !label) continue;
    out[key] = label;
  }
  return out;
}

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
            else if (t === "string_compare") onChange({ type: "string_compare", var: "location", op: "=", value: "" });
            else if (t === "participant_present") onChange({ type: "participant_present", name: "" });
            else onChange({ type: "variable_compare", var: "affection", op: ">=", value: 50 });
          }}
          className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
        >
          <option value="text_includes">유저입력 텍스트 포함</option>
          <option value="variable_compare">변수 비교(숫자)</option>
          <option value="string_compare">변수 비교(문자)</option>
          <option value="participant_present">참여자 포함 여부</option>
          <option value="inactive_time">미접속 시간</option>
        </select>

        {c.type === "text_includes" ? (
          <div className="min-w-[320px] flex-1">
            <TagInput values={c.values} onChange={(values) => onChange({ ...c, values })} />
          </div>
        ) : null}

        {c.type === "variable_compare" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={c.var}
              onChange={(e) => onChange({ ...c, var: e.target.value })}
              list="panana-var-compare-list"
              className="min-w-[160px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none placeholder:text-white/25"
              placeholder="변수 키 (예: stress)"
            />
            <datalist id="panana-var-compare-list">
              <option value="affection" />
              <option value="risk" />
              <option value="stress" />
              <option value="alcohol" />
              <option value="jealousy" />
              <option value="performance" />
              <option value="fatigue" />
              <option value="trust" />
              <option value="submission" />
              <option value="dependency" />
              <option value="suspicion" />
              <option value="sales" />
              <option value="debt" />
            </datalist>
            <select
              value={c.op}
              onChange={(e) => onChange({ ...c, op: e.target.value as any })}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
            >
              <option value="<">&lt;</option>
              <option value=">">&gt;</option>
              <option value="<=">&le;</option>
              <option value=">=">&ge;</option>
              <option value="=">=</option>
            </select>
            <input
              value={c.value}
              onChange={(e) => onChange({ ...c, value: Number(e.target.value) || 0 })}
              className="w-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
            />
          </div>
        ) : null}

        {c.type === "string_compare" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={c.var}
              onChange={(e) => onChange({ ...c, var: e.target.value })}
              list="panana-var-string-list"
              className="min-w-[160px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none placeholder:text-white/25"
              placeholder="변수 키 (예: location)"
            />
            <datalist id="panana-var-string-list">
              <option value="location" />
              <option value="time" />
            </datalist>
            <select
              value={c.op}
              onChange={(e) => onChange({ ...c, op: e.target.value as any })}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
            >
              <option value="=">=</option>
              <option value="!=">!=</option>
            </select>
            <input
              value={c.value}
              onChange={(e) => onChange({ ...c, value: e.target.value })}
              className="min-w-[160px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none"
              placeholder="값 (예: 탕비실)"
            />
          </div>
        ) : null}

        {c.type === "participant_present" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={c.name}
              onChange={(e) => onChange({ ...c, name: e.target.value })}
              className="min-w-[180px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none placeholder:text-white/25"
              placeholder="참여자 이름 (예: 최 전무)"
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
  nameSuggestions = [],
  showJsonPreview = true,
  labelScope,
  contextVarLabels,
}: {
  title: string;
  subtitle?: string;
  value: TriggerRulesPayload;
  onChange: (next: TriggerRulesPayload) => void;
  nameSuggestions?: string[];
  showJsonPreview?: boolean;
  labelScope?: "project" | "scene" | "character";
  // 다른 스코프에서 내려오는 라벨(충돌/최종 적용 미리보기용)
  contextVarLabels?: Partial<Record<VarLabelScope, Record<string, string>>>;
}) {
  const rules = value.rules;
  const varLabels = useMemo(() => normalizeVarLabels((value as any)?.varLabels), [value]);
  const previewMaps = useMemo(() => {
    const baseProject = normalizeVarLabels((contextVarLabels as any)?.project);
    const baseScene = normalizeVarLabels((contextVarLabels as any)?.scene);
    const baseCharacter = normalizeVarLabels((contextVarLabels as any)?.character);

    const project = labelScope === "project" ? varLabels : baseProject;
    const scene = labelScope === "scene" ? varLabels : baseScene;
    const character = labelScope === "character" ? varLabels : baseCharacter;
    return { project, scene, character };
  }, [contextVarLabels, labelScope, varLabels]);

  const updateRule = (id: string, patch: Partial<TriggerRule>) => {
    onChange({ ...value, rules: rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
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

      {/* 변수 라벨(표시명) 설정 */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[13px] font-extrabold text-white/85">변수 라벨(표시명)</div>
              {labelScope ? (
                <span className="rounded-full bg-white/[0.06] px-2 py-[2px] text-[10px] font-extrabold text-white/60 ring-1 ring-white/10">
                  {labelScope === "character" ? "캐릭터(최우선)" : labelScope === "scene" ? "씬(중간)" : "프로젝트(기본)"}
                </span>
              ) : null}
              <span className="text-[10px] font-extrabold text-white/35">
                적용 우선순위: <span className="text-white/55">캐릭터 &gt; 씬 &gt; 프로젝트</span>
              </span>
            </div>
            <div className="mt-1 text-[11px] font-semibold text-white/35">
              채팅에서 <span className="text-white/60">변수키(영문)</span>를 그대로 노출하지 않도록, 콘텐츠별로 표시명을 지정합니다.
              <span className="ml-2 text-white/45">예: contract → 광고 계약확률</span>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg bg-white/[0.06] px-3 py-2 text-[11px] font-extrabold text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08]"
            onClick={() => {
              const next = { ...varLabels };
              // 빈 엔트리 한 개 추가(키는 임시로 unique)
              const seedBase = "new_var";
              let k = seedBase;
              for (let i = 2; i < 99 && next[k]; i++) k = `${seedBase}_${i}`;
              next[k] = "표시명";
              onChange({ ...value, varLabels: next });
            }}
          >
            + 라벨 추가
          </button>
        </div>

        {!Object.keys(varLabels).length ? (
          <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-[12px] font-semibold text-white/45">
            아직 라벨이 없어요. <span className="text-white/70">+ 라벨 추가</span>로 입력하세요.
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {Object.entries(varLabels).map(([k, label]) => (
              <div key={k} className="flex flex-wrap items-center gap-2">
                <input
                  value={k}
                  onChange={(e) => {
                    const next = { ...varLabels };
                    const prevKey = k;
                    const nextKey = normalizeVarKey(e.target.value);
                    const v = next[prevKey];
                    delete next[prevKey];
                    if (nextKey) next[nextKey] = v;
                    onChange({ ...value, varLabels: next });
                  }}
                  className="w-[160px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/80 outline-none placeholder:text-white/25"
                  placeholder="변수키 (예: contract)"
                />
                <span className="text-white/35">→</span>
                <input
                  value={label}
                  onChange={(e) => {
                    const next = { ...varLabels, [k]: String(e.target.value || "").slice(0, 24) };
                    onChange({ ...value, varLabels: next });
                  }}
                  className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/80 outline-none placeholder:text-white/25"
                  placeholder="표시명 (예: 광고 계약확률)"
                />
                <button
                  type="button"
                  className="rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] font-extrabold text-white/55 ring-1 ring-white/10 hover:bg-white/[0.05]"
                  onClick={() => {
                    const next = { ...varLabels };
                    delete next[k];
                    onChange({ ...value, varLabels: next });
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <VarLabelResolutionPreview
          editingScope={labelScope}
          project={previewMaps.project}
          scene={previewMaps.scene}
          character={previewMaps.character}
        />
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
                  onClick={() => onChange({ ...value, rules: rules.filter((x) => x.id !== r.id) })}
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
                          <input
                            value={a.var}
                            onChange={(e) => updateRule(r.id, { then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, var: e.target.value } as any) : x)) } })}
                            list={`panana-var-mod-list-${r.id}-${aIdx}`}
                            className="min-w-[160px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none placeholder:text-white/25"
                            placeholder="변수 키 (예: stress)"
                          />
                          <datalist id={`panana-var-mod-list-${r.id}-${aIdx}`}>
                            <option value="affection" />
                            <option value="risk" />
                            <option value="stress" />
                            <option value="alcohol" />
                            <option value="jealousy" />
                            <option value="performance" />
                            <option value="fatigue" />
                            <option value="trust" />
                            <option value="submission" />
                            <option value="dependency" />
                            <option value="suspicion" />
                            <option value="sales" />
                            <option value="debt" />
                          </datalist>
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

                      {a.type === "variable_set" ? (
                        <ActionRow label="결과 유형: 변수 값 설정">
                          <input
                            value={a.var}
                            onChange={(e) => updateRule(r.id, { then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, var: e.target.value } as any) : x)) } })}
                            list={`panana-var-set-list-${r.id}-${aIdx}`}
                            className="min-w-[160px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none placeholder:text-white/25"
                            placeholder="변수 키 (예: location)"
                          />
                          <datalist id={`panana-var-set-list-${r.id}-${aIdx}`}>
                            <option value="location" />
                            <option value="time" />
                          </datalist>
                          <input
                            value={String((a as any).value ?? "")}
                            onChange={(e) => updateRule(r.id, { then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, value: e.target.value } as any) : x)) } })}
                            className="min-w-[160px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none placeholder:text-white/25"
                            placeholder="값 (예: 탕비실)"
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

                      {a.type === "join" ? (
                        <ActionRow label="결과 유형: 참여자 합류 (join)">
                          <input
                            value={(a as any).name || ""}
                            onChange={(e) =>
                              updateRule(r.id, {
                                then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, name: e.target.value } as any) : x)) },
                              })
                            }
                            list={`panana-join-suggest-${r.id}-${aIdx}`}
                            className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none placeholder:text-white/25"
                            placeholder="예: 김희진"
                          />
                          {nameSuggestions.length ? (
                            <datalist id={`panana-join-suggest-${r.id}-${aIdx}`}>
                              {nameSuggestions.map((n) => (
                                <option key={n} value={n} />
                              ))}
                            </datalist>
                          ) : null}
                        </ActionRow>
                      ) : null}

                      {a.type === "leave" ? (
                        <ActionRow label="결과 유형: 참여자 퇴장 (leave)">
                          <input
                            value={(a as any).name || ""}
                            onChange={(e) =>
                              updateRule(r.id, {
                                then: { actions: r.then.actions.map((x, i) => (i === aIdx ? ({ ...a, name: e.target.value } as any) : x)) },
                              })
                            }
                            list={`panana-leave-suggest-${r.id}-${aIdx}`}
                            className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-extrabold text-white/75 outline-none placeholder:text-white/25"
                            placeholder="예: 김희진"
                          />
                          {nameSuggestions.length ? (
                            <datalist id={`panana-leave-suggest-${r.id}-${aIdx}`}>
                              {nameSuggestions.map((n) => (
                                <option key={n} value={n} />
                              ))}
                            </datalist>
                          ) : null}
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

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-3 text-[12px] font-extrabold text-white/55 hover:bg-white/[0.03]"
                      onClick={() =>
                        updateRule(r.id, { then: { actions: [...r.then.actions, { type: "system_message", text: "" }] } })
                      }
                    >
                      + 시스템 메시지
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-3 text-[12px] font-extrabold text-white/55 hover:bg-white/[0.03]"
                      onClick={() =>
                        updateRule(r.id, {
                          then: { actions: [...r.then.actions, { type: "variable_mod", var: "affection", op: "+", value: 1 }] },
                        })
                      }
                    >
                      + 변수 변경
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-3 text-[12px] font-extrabold text-white/55 hover:bg-white/[0.03]"
                      onClick={() =>
                        updateRule(r.id, {
                          then: { actions: [...r.then.actions, { type: "variable_set", var: "location", value: "" }] },
                        })
                      }
                    >
                      + 변수 설정
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-3 text-[12px] font-extrabold text-white/55 hover:bg-white/[0.03]"
                      onClick={() => updateRule(r.id, { then: { actions: [...r.then.actions, { type: "join", name: "" }] } })}
                    >
                      + 참여자 합류
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-3 text-[12px] font-extrabold text-white/55 hover:bg-white/[0.03]"
                      onClick={() => updateRule(r.id, { then: { actions: [...r.then.actions, { type: "leave", name: "" }] } })}
                    >
                      + 참여자 퇴장
                    </button>
                  </div>
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

