import type { TriggerAction, TriggerCondition, TriggerRulesPayload } from "@/lib/studio/types";

export type ChatRuntimeState = {
  variables: Record<string, any>;
  // group chat participants (names)
  participants: string[];
  // ISO timestamp
  lastActiveAt: string | null;
  // rule firing memory (ISO timestamp per rule id)
  firedAt: Record<string, string>;
};

export type ChatRuntimeEvent =
  | { type: "system_message"; text: string }
  | { type: "join"; name: string }
  | { type: "leave"; name: string }
  | { type: "var_delta"; var: string; op: "+" | "-"; value: number }
  | { type: "unlock_suggest"; text: string }
  | { type: "reset_offer"; text: string }
  | { type: "premium_offer"; text: string }
  | { type: "ep_unlock"; text: string };

function nowIso(now: Date) {
  return now.toISOString();
}

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hoursBetween(aIso: string | null, now: Date) {
  if (!aIso) return 0;
  const t = new Date(aIso).getTime();
  if (!Number.isFinite(t)) return 0;
  const diff = now.getTime() - t;
  return diff > 0 ? diff / (1000 * 60 * 60) : 0;
}

function evalCondition(args: {
  c: TriggerCondition;
  userText: string;
  state: ChatRuntimeState;
  now: Date;
}): boolean {
  const { c, userText, state, now } = args;
  if (c.type === "text_includes") {
    const hay = String(userText || "");
    return (c.values || []).some((v) => {
      const needle = String(v || "").trim();
      if (!needle) return false;
      return hay.includes(needle);
    });
  }
  if (c.type === "variable_compare") {
    const lhs = toNum((state.variables as any)[c.var]);
    const rhs = toNum(c.value);
    if (c.op === "<") return lhs < rhs;
    if (c.op === ">") return lhs > rhs;
    return lhs === rhs;
  }
  if (c.type === "inactive_time") {
    const h = hoursBetween(state.lastActiveAt, now);
    return h >= toNum(c.hours);
  }
  return false;
}

function applyAction(args: { a: TriggerAction; state: ChatRuntimeState; events: ChatRuntimeEvent[] }) {
  const { a, state, events } = args;
  if (a.type === "variable_mod") {
    const cur = toNum((state.variables as any)[a.var]);
    const delta = toNum(a.value);
    (state.variables as any)[a.var] = a.op === "-" ? cur - delta : cur + delta;
    // UI용: 사람이 읽기 좋은 변수 변화 이벤트
    if (delta !== 0) events.push({ type: "var_delta", var: String(a.var || ""), op: a.op, value: delta });
    return;
  }
  if (a.type === "system_message") {
    events.push(...parseDirectiveText(String(a.text || "")));
    return;
  }
  if (a.type === "join") {
    const name = String(a.name || "").trim();
    if (name) events.push({ type: "join", name });
    return;
  }
  if (a.type === "leave") {
    const name = String(a.name || "").trim();
    if (name) events.push({ type: "leave", name });
    return;
  }
  if (a.type === "status_effect") {
    // 현재 UI/LLM에는 아직 직접 반영하지 않지만, 변수로도 노출 가능하게 저장
    const key = String(a.key || "").trim();
    if (key) (state.variables as any)[`status_${key}`] = toNum(a.turns) || 0;
    return;
  }
}

function stripQuotes(s: string) {
  const t = String(s || "").trim();
  const m = /^["'“”‘’](.*)["'“”‘’]$/.exec(t);
  return m ? String(m[1]) : t;
}

function parseVarDelta(valRaw: string): { var: string; op: "+" | "-"; value: number } | null {
  const v = String(valRaw || "").trim();
  // 지원: stress+30 / risk-10 / affection + 5
  const m = /^([a-zA-Z0-9_]+)\s*([+-])\s*([0-9]{1,6})$/.exec(v);
  if (!m) return null;
  const name = String(m[1] || "").trim();
  const op = (m[2] === "-" ? "-" : "+") as "+" | "-";
  const num = Number(m[3]) || 0;
  if (!name || !num) return null;
  return { var: name, op, value: num };
}

/**
 * system_message 문자열에 join/leave/unlock_suggest 같은 지시어가 섞여있을 때 해석한다.
 * 예: `join:김희진; system_message:"희진이 영상통화를 걸어왔습니다!"`
 */
export function parseDirectiveText(raw: string): ChatRuntimeEvent[] {
  const s = String(raw || "").trim();
  if (!s) return [];

  const parts = s
    .split(/[;\n]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  const out: ChatRuntimeEvent[] = [];
  const leftover: string[] = [];

  for (const p of parts) {
    const m = /^([a-z_]+)\s*:\s*(.+)$/i.exec(p);
    if (!m) {
      leftover.push(p);
      continue;
    }
    const key = String(m[1] || "").toLowerCase();
    const val = stripQuotes(m[2]);

    if (key === "join") out.push({ type: "join", name: val });
    else if (key === "leave") out.push({ type: "leave", name: val });
    else if (key === "variable_mod" || key === "var" || key === "vardelta") {
      const parsed = parseVarDelta(val);
      if (parsed) out.push({ type: "var_delta", ...parsed });
      else leftover.push(p);
    }
    else if (key === "system_message") out.push({ type: "system_message", text: val });
    else if (key === "unlock_suggest") out.push({ type: "unlock_suggest", text: val });
    else if (key === "reset_offer") out.push({ type: "reset_offer", text: val });
    else if (key === "premium_offer") out.push({ type: "premium_offer", text: val });
    else if (key === "ep_unlock") out.push({ type: "ep_unlock", text: val });
    else {
      // 알 수 없는 키는 시스템 메시지로 흡수(호환)
      leftover.push(p);
    }
  }

  if (leftover.length) {
    out.push({ type: "system_message", text: leftover.join(" ") });
  }

  return out;
}

export function applyTriggerPayloads(args: {
  now: Date;
  userText: string;
  state: ChatRuntimeState;
  payloads: Array<TriggerRulesPayload | null | undefined>;
}): { state: ChatRuntimeState; events: ChatRuntimeEvent[] } {
  const { now, userText } = args;
  const state: ChatRuntimeState = {
    variables: { ...(args.state?.variables || {}) },
    participants: Array.isArray(args.state?.participants) ? [...args.state.participants] : [],
    lastActiveAt: args.state?.lastActiveAt || null,
    firedAt: { ...(args.state?.firedAt || {}) },
  };

  const events: ChatRuntimeEvent[] = [];

  const allRules = args.payloads
    .flatMap((p) => (Array.isArray((p as any)?.rules) ? (p as any).rules : []))
    .filter((r: any) => r && r.enabled !== false);

  for (const r of allRules) {
    const id = String(r.id || "");
    // 같은 턴에서 중복 발동 최소화(연타 방지)
    if (id && state.firedAt[id]) continue;

    const joinType = (r?.if?.type === "OR" ? "OR" : "AND") as "AND" | "OR";
    const conds = Array.isArray(r?.if?.conditions) ? r.if.conditions : [];
    const results = conds.map((c: any) => evalCondition({ c, userText, state, now }));
    const ok = joinType === "OR" ? results.some(Boolean) : results.every(Boolean);
    if (!ok) continue;

    const actions: TriggerAction[] = Array.isArray(r?.then?.actions) ? r.then.actions : [];
    for (const a of actions) applyAction({ a, state, events });

    if (id) state.firedAt[id] = nowIso(now);
  }

  // join/leave 이벤트로 participants 갱신
  for (const e of events) {
    if (e.type === "join") {
      const name = String(e.name || "").trim();
      if (name && !state.participants.includes(name)) state.participants.push(name);
    } else if (e.type === "leave") {
      const name = String(e.name || "").trim();
      if (name) state.participants = state.participants.filter((x) => x !== name);
    }
  }

  state.lastActiveAt = nowIso(now);
  return { state, events };
}

