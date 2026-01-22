export type TemplateVars = Record<string, string | number | boolean>;

function safeString(v: any) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * {{var}} 형태의 템플릿 치환
 * - 값이 없으면 원문을 유지(저작자가 누락을 인지하기 쉬움 + 기존 동작 하위호환)
 */
export function interpolateTemplate(input: string, vars: TemplateVars) {
  const s = String(input || "");
  if (!s.includes("{{")) return s;
  return s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, key) => {
    const k = String(key || "");
    if (!k) return m;
    if (!(k in vars)) return m;
    const v = (vars as any)[k];
    const out = safeString(v);
    return out.length ? out : m;
  });
}

export function computeTimeOfDay(now: Date) {
  const h = now.getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

/**
 * runtime.variables + 파생 변수들을 합쳐 템플릿 변수 집합을 만든다.
 * - affection_score ↔ affection 별칭 매핑
 * - time_of_day 기본값 제공
 * - user_name이 있으면 call_sign 기본값(선택)
 */
export function buildTemplateVars(args: { runtimeVariables?: Record<string, any> | null }) {
  const base = (args.runtimeVariables || {}) as Record<string, any>;
  const vars: TemplateVars = { ...base };

  // time_of_day 기본 제공
  if (vars.time_of_day == null || String(vars.time_of_day).trim() === "") {
    vars.time_of_day = computeTimeOfDay(new Date());
  }

  // affection alias
  const aff = base.affection ?? base.affection_score;
  if (aff != null) {
    if (vars.affection == null) vars.affection = aff;
    if (vars.affection_score == null) vars.affection_score = aff;
  }

  // user_name / call_sign (옵션)
  const userName = String(base.user_name || "").trim();
  if (userName && vars.user_name == null) vars.user_name = userName;
  const aNum = Number(vars.affection ?? 0) || 0;
  if (!("call_sign" in vars) || !String((vars as any).call_sign || "").trim()) {
    if (userName) {
      if (aNum <= 30) vars.call_sign = userName; // 초기엔 이름 그대로
      else if (aNum <= 70) vars.call_sign = userName;
      else vars.call_sign = `${userName}야`;
    }
  }

  return vars;
}

