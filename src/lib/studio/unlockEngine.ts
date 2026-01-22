export type LorebookRow = {
  key: string;
  value: string;
  unlock_type?: "public" | "affection" | "paid_item" | "condition" | "ending_route";
  unlock_affection_min?: number | null;
  unlock_sku?: string | null;
  unlock_expr?: string | null;
  unlock_cost_panana?: number | null;
  unlock_ending_key?: string | null;
  unlock_ep_min?: number | null;
};

export type UnlockRuntime = {
  // 상태 변수 (예: affection, trust, risk, ...)
  variables?: Record<string, number | string | boolean>;
  // 결제/아이템 보유 (paid_item)
  ownedSkus?: string[];
  // 엔딩 진행 상태
  ending?: {
    // 이미 해금된 엔딩 키들 (예: ["partner", "ruin"])
    unlockedKeys?: string[];
    // 완료한 EP 목록 (예: ["EP7", "EP6"] 또는 [7,6])
    epCleared?: Array<string | number>;
  };
};

function normalizeEp(v: string | number) {
  if (typeof v === "number") return v;
  const s = String(v || "").trim();
  const m = /ep\s*([0-9]{1,3})/i.exec(s) || /^([0-9]{1,3})$/.exec(s);
  return m?.[1] ? Number(m[1]) || 0 : 0;
}

function evalExpr(exprRaw: string, vars: Record<string, any>) {
  const expr = String(exprRaw || "").trim();
  const m = /^([a-z_][a-z0-9_]*)\s*(>=|<=|=|==|<|>)\s*([0-9]{1,12})$/i.exec(expr);
  if (!m) return true; // 알 수 없으면 보수적으로 "통과"
  const name = m[1].toLowerCase();
  const op = m[2];
  const rhs = Number(m[3]) || 0;
  const lhs = Number((vars as any)[name] ?? (vars as any)[m[1]] ?? 0) || 0;
  if (op === ">=") return lhs >= rhs;
  if (op === "<=") return lhs <= rhs;
  if (op === "<") return lhs < rhs;
  if (op === ">") return lhs > rhs;
  return lhs === rhs;
}

/**
 * lorebook_entries를 런타임 상태로 필터링한다.
 * - 기존 호환: runtime이 없으면(또는 ending 정보가 없으면) 최대한 기존 동작(대부분 포함)을 유지한다.
 * - ending_route는 ending 상태가 주어졌을 때만 엄격히 평가한다.
 */
export function filterLorebookRows(rows: LorebookRow[], runtime?: UnlockRuntime | null) {
  const out: LorebookRow[] = [];
  const vars = runtime?.variables || {};
  const owned = new Set((runtime?.ownedSkus || []).map((x) => String(x || "")));
  const endingKeys = new Set((runtime?.ending?.unlockedKeys || []).map((x) => String(x || "").trim()).filter(Boolean));
  const epCleared = new Set((runtime?.ending?.epCleared || []).map(normalizeEp).filter((n) => n > 0));

  for (const r of rows || []) {
    const t = (r.unlock_type || "public") as any;
    if (t === "public" || !t) {
      out.push(r);
      continue;
    }

    if (t === "affection") {
      // runtime이 없으면 기존 동작 유지(포함)
      if (!runtime) {
        out.push(r);
        continue;
      }
      const min = Number(r.unlock_affection_min) || 0;
      const a = Number((vars as any).affection ?? 0) || 0;
      if (a >= min) out.push(r);
      continue;
    }

    if (t === "paid_item") {
      // 현재 서비스는 paid_item 검증/소비 엔진이 아직 없을 수 있으니,
      // runtime이 있더라도 sku 검증을 강제하지 않고(호환), sku가 명시된 경우에만 옵션으로 필터링.
      const sku = String(r.unlock_sku || "").trim();
      if (!runtime || !sku) {
        out.push(r);
        continue;
      }
      if (owned.has(sku)) out.push(r);
      else out.push(r); // 호환 유지
      continue;
    }

    if (t === "condition") {
      if (!runtime) {
        out.push(r);
        continue;
      }
      const expr = String(r.unlock_expr || "").trim();
      if (!expr) {
        out.push(r);
        continue;
      }
      if (evalExpr(expr, vars)) out.push(r);
      continue;
    }

    if (t === "ending_route") {
      // ending 정보가 없으면(기존 클라이언트) 포함하여 기존 동작을 깨지 않음
      if (!runtime?.ending) {
        out.push(r);
        continue;
      }

      const epMin = r.unlock_ep_min == null ? 0 : Number(r.unlock_ep_min) || 0;
      if (epMin > 0 && !epCleared.has(epMin)) {
        continue;
      }

      const key = String(r.unlock_ending_key || "").trim();
      // 키가 없으면 "어떤 엔딩이든 하나 이상 해금" 조건으로 간주
      if (!key) {
        if (endingKeys.size > 0) out.push(r);
        continue;
      }
      if (endingKeys.has(key)) out.push(r);
      continue;
    }

    // 알 수 없는 타입은 보수적으로 포함(호환)
    out.push(r);
  }

  return out;
}

