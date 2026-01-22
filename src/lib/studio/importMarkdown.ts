import type { StudioPromptState, PromptLorebookItem, TriggerRulesPayload } from "@/lib/studio/types";
import { parseDirectiveText } from "@/lib/studio/chatRuntimeEngine";

export type StudioImportResult = {
  ok: boolean;
  warnings: string[];
  promptPatch: Partial<StudioPromptState> | null;
  lorebook: PromptLorebookItem[] | null;
  triggers: TriggerRulesPayload | null;
  projectLorebook: PromptLorebookItem[] | null;
  projectRules: TriggerRulesPayload | null;
  publicProfile:
    | {
        handle?: string;
        hashtags?: string[];
        tagline?: string;
        introTitle?: string;
        introLines?: string[];
        moodTitle?: string;
        moodLines?: string[];
      }
    | null;
  projectScenes:
    | Array<{
        slug: string;
        title: string;
        episodeLabel: string;
        groupChatEnabled: boolean;
        seedLorebookValue?: string;
        seedRules?: TriggerRulesPayload;
      }>
    | null;
};

function dedupeWarnings(warnings: string[]) {
  // Set preserves insertion order
  return Array.from(new Set((warnings || []).filter(Boolean)));
}

type LorebookWarnCtx = {
  unknownUnlockRaw: Set<string>;
};

function pushUnknownUnlockSummary(warnings: string[], ctx: LorebookWarnCtx) {
  if (!ctx.unknownUnlockRaw.size) return;
  const list = Array.from(ctx.unknownUnlockRaw);
  const head = list.slice(0, 6).join(", ");
  const tail = list.length > 6 ? ` 외 ${list.length - 6}개` : "";
  warnings.push(`로어북 Unlock 값을 해석하지 못한 항목이 ${list.length}개 있어 public으로 저장됩니다. (${head}${tail})`);
}

function normalize(md: string) {
  return md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseHashtagList(raw: string) {
  const tokens = String(raw || "")
    .split(/[\s,，]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
  const tags = tokens
    .flatMap((t) => {
      const cleaned = t.replace(/^#/, "").trim();
      return cleaned ? [cleaned] : [];
    })
    .filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 30);
}

function extractPublicProfile(md: string): StudioImportResult["publicProfile"] {
  const text = normalize(md || "");

  // @핸들: @Prof_Cha_Neuro
  const mHandle = /(?:^|\n)\s*(?:[•\u2022\-\*]\s*)?@?\s*핸들\s*[:：]\s*@?([A-Za-z0-9_.-]{2,64})\s*(?:\n|$)/i.exec(text);
  const handle = mHandle?.[1] ? String(mHandle[1]).trim() : "";

  // 한줄소개: "..."
  const mTagline =
    /(?:^|\n)\s*(?:[•\u2022\-\*]\s*)?한\s*줄\s*소개\s*[:：]\s*["“]?([^\n”"]+)["”]?\s*(?:\n|$)/i.exec(text) ||
    /(?:^|\n)\s*(?:[•\u2022\-\*]\s*)?한줄소개\s*[:：]\s*["“]?([^\n”"]+)["”]?\s*(?:\n|$)/i.exec(text);
  const tagline = mTagline?.[1] ? String(mTagline[1]).trim() : "";

  // 태그(10개): #a #b ...
  const mTags =
    /(?:^|\n)\s*(?:[•\u2022\-\*]\s*)?태그[^\n:：]*[:：]\s*([^\n]+)\s*(?:\n|$)/i.exec(text) ||
    /(?:^|\n)\s*(?:[•\u2022\-\*]\s*)?해시태그[^\n:：]*[:：]\s*([^\n]+)\s*(?:\n|$)/i.exec(text);
  const hashtags = mTags?.[1] ? parseHashtagList(String(mTags[1])) : [];

  // 프로필 소개/상태(선택)
  const introSec =
    extractSection(text, /프로필\s*소개[\s\S]*?\n/i, [/프로필\s*상태/m, /^\s*[A-I]\)\s*/m, /^\s*\[운영자\s*메모\]/m]) || "";
  const moodSec =
    extractSection(text, /프로필\s*상태[\s\S]*?\n/i, [/^\s*[A-I]\)\s*/m, /^\s*\[운영자\s*메모\]/m]) || "";

  const parseTitleAndLines = (sec: string) => {
    const lines = String(sec || "")
      .split("\n")
      .map((l) => l.replace(/\r/g, ""))
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (!lines.length) return { title: "", lines: [] as string[] };
    const m = /[:：]\s*(.+)$/.exec(lines[0]);
    const title = m?.[1] ? String(m[1]).trim() : "";
    const rest = title ? lines.slice(1) : lines;
    const body = rest
      .map((l) => l.replace(/^(?:[•\u2022\-\*]\s*)/, "").trim())
      .filter(Boolean)
      .slice(0, 12);
    return { title, lines: body };
  };

  const intro = parseTitleAndLines(introSec);
  const mood = parseTitleAndLines(moodSec);

  const out = {
    handle: handle || undefined,
    hashtags: hashtags.length ? hashtags : undefined,
    tagline: tagline || undefined,
    introTitle: intro.title || undefined,
    introLines: intro.lines.length ? intro.lines : undefined,
    moodTitle: mood.title || undefined,
    moodLines: mood.lines.length ? mood.lines : undefined,
  };

  const hasAny =
    Boolean(out.handle) ||
    Boolean(out.tagline) ||
    Boolean(out.hashtags?.length) ||
    Boolean(out.introTitle) ||
    Boolean(out.introLines?.length) ||
    Boolean(out.moodTitle) ||
    Boolean(out.moodLines?.length);

  return hasAny ? out : null;
}

function extractSection(md: string, startRe: RegExp, endRes: RegExp[]) {
  const m = startRe.exec(md);
  if (!m) return null;
  const start = m.index + m[0].length;
  const tail = md.slice(start);
  let end = tail.length;
  for (const re of endRes) {
    const mm = re.exec(tail);
    if (mm && mm.index < end) end = mm.index;
  }
  return tail.slice(0, end).trim();
}

function extractFirstJsonCodeBlock(md: string): any | null {
  const re = /```json\s*([\s\S]*?)```/i;
  const m = re.exec(md);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function extractField(block: string, label: string) {
  // "라벨:" 다음 줄부터 다음 라벨/리스트 시작 전까지
  const re = new RegExp(`${label}\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n\\s*[-*]\\s+\\S|\\n\\s*\\w+\\s*:?\\s*$|\\n\\s*\\w+\\s*\\(|\\n\\s*\\w+\\s*:)`, "i");
  const m = re.exec(block);
  if (!m) return "";
  return String(m[1] || "").trim();
}

function parseFewShotPairs(md: string) {
  const pairs: Array<{ id: string; user: string; bot: string }> = [];
  // 정규식으로 문서 전체를 한 번에 파싱하면 (특히 불릿 문자 포함 시) 빌드(SWC) 단계에서 정규식 파싱이 깨지는 경우가 있어,
  // 안전하게 "라인 스캐닝"으로 USER/CHAR 쌍을 수집한다.
  //
  // 지원:
  // - 불릿(o/•/-/*) + USER: ... / CHAR: ...
  // - 다국어 라벨: USER|User|유저  /  ASSISTANT|Assistant|BOT|캐릭터|윤세아|CHAR|Char
  // - 같은 줄: "USER: ... CHAR: ..."
  const BULLET_DOT = "\u2022"; // •
  const stripBullet = (line: string) => {
    let s = (line || "").trim();
    const first = s.slice(0, 1);
    if (first === "o" || first === "-" || first === "*" || first === BULLET_DOT) {
      s = s.slice(1).trimStart();
    }
    return s;
  };

  const isStopHeading = (line: string) => {
    const s = stripBullet(line);
    return (
      /^\[Author Note\]/i.test(s) ||
      /^Author Note/i.test(s) ||
      /^[D-G]\)\s*/i.test(s) ||
      /^\[운영자\s*메모\]/i.test(s) ||
      /^운영자\s*메모/i.test(s)
    );
  };

  const reSame =
    /^(?:USER|User|유저)\s*:\s*(.+?)\s+(?:ASSISTANT|Assistant|BOT|캐릭터|윤세아|CHAR|Char)\s*:\s*(.+)$/i;
  const reUser = /^(?:USER|User|유저)\s*:\s*(.*)$/i;
  const reBot = /^(?:ASSISTANT|Assistant|BOT|캐릭터|윤세아|CHAR|Char)\s*:\s*(.*)$/i;

  let idx = 0;
  const lines = md.split("\n");
  let pendingUser: string | null = null;
  let pendingBot: string | null = null;
  let collecting: "user" | "bot" | null = null;

  const flush = () => {
    if (pendingUser && pendingBot) {
      pairs.push({ id: `fs-${++idx}`, user: pendingUser.trim(), bot: pendingBot.trim() });
    }
    pendingUser = null;
    pendingBot = null;
    collecting = null;
  };

  for (const raw of lines) {
    const line = stripBullet(raw);
    if (!line) continue;
    if (isStopHeading(line)) break;

    const mSame = reSame.exec(line);
    if (mSame) {
      flush();
      pendingUser = String(mSame[1] || "").trim();
      pendingBot = String(mSame[2] || "").trim();
      flush();
      if (pairs.length >= 20) break;
      continue;
    }

    const mU = reUser.exec(line);
    if (mU) {
      if (pendingUser && pendingBot) flush();
      pendingUser = String(mU[1] || "").trim();
      pendingBot = null;
      collecting = "user";
      continue;
    }

    const mB = reBot.exec(line);
    if (mB) {
      pendingBot = String(mB[1] || "").trim();
      collecting = "bot";
      continue;
    }

    if (collecting === "user" && pendingUser != null && pendingBot == null) {
      pendingUser = `${pendingUser}\n${line}`.trim();
      continue;
    }
    if (collecting === "bot" && pendingBot != null) {
      pendingBot = `${pendingBot}\n${line}`.trim();
      continue;
    }
  }

  if (pendingUser && pendingBot) flush();
  return pairs;
}

function parseLorebookTable(section: string, warnings: string[], ctx?: LorebookWarnCtx): PromptLorebookItem[] | null {
  // key | value | unlock(...) | merge(...) | cost_panana(...)
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const headerIdx = lines.findIndex((l) => l.includes("|") && /key\s*\|/i.test(l) && /value\s*\|/i.test(l));
  if (headerIdx === -1) return null;

  const out: PromptLorebookItem[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.includes("|")) continue;
    if (/^\|?\s*-{2,}\s*\|/.test(l)) continue; // separator
    const cols = l
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cols.length < 3) continue;
    const key = cols[0];
    const value = cols[1];
    const unlockRaw = String(cols[2] || "").trim();
    const unlockStr = unlockRaw.toLowerCase();
    const mergeStr = (cols[3] || "").toLowerCase();
    const costStr = (cols[4] || "").toLowerCase();
    let unlock: PromptLorebookItem["unlock"] = { type: "public" };
    let mergeMode: PromptLorebookItem["mergeMode"] = "override";

    // cost_panana가 있으면 sku에 PANA:<숫자> 형태로 기록(향후 unlock 엔진이 해석)
    const mCost = /(\d+)/.exec(costStr);
    const cost = mCost ? Number(mCost[1]) : 0;

    // unlock parsing:
    // - public
    // - paid_item (+ cost -> PANA:<cost>)
    // - affection>=N (또는 affection)
    // - trust/risk/submission/debt...>=N -> condition(expr + optional costPanana)
    // - ending_route(옵션: ending_route:KEY / ending_route ep>=7)
    const mAff = /(affection)\s*>=\s*(\d+)/i.exec(unlockRaw);
    if (mAff) {
      unlock = { type: "affection", min: Number(mAff[2]) || 0 };
    } else if (unlockStr.includes("ending_route") || unlockStr.includes("ending-route")) {
      const mKey = /ending[_-]route\s*[:=]\s*([a-z0-9_\-]+)/i.exec(unlockRaw);
      const mEp = /\bep\s*>=\s*(\d{1,3})/i.exec(unlockRaw);
      unlock = {
        type: "ending_route",
        endingKey: mKey?.[1] ? String(mKey[1]).trim() : undefined,
        epMin: mEp?.[1] ? Number(mEp[1]) || 0 : undefined,
        costPanana: cost > 0 ? cost : undefined,
      };
    } else if (unlockStr.includes("affection")) {
      unlock = { type: "affection", min: 30 };
    } else if (unlockStr.includes("public")) {
      unlock = { type: "public" };
    } else if (unlockStr.includes("paid_item") || unlockStr.includes("paid")) {
      unlock = { type: "paid_item", sku: cost > 0 ? `PANA:${cost}` : "PANA:1000" };
    } else {
      const mCond = /([a-z_]+)\s*(>=|<=|=|<|>)\s*(\d+)/i.exec(unlockRaw);
      if (mCond) {
        const expr = `${mCond[1]}${mCond[2]}${mCond[3]}`;
        unlock = { type: "condition", expr, costPanana: cost > 0 ? cost : undefined };
      } else if (unlockRaw) {
        if (ctx) ctx.unknownUnlockRaw.add(unlockRaw);
        else warnings.push(`로어북 Unlock "${unlockRaw}"를 해석하지 못해 public으로 저장됩니다.`);
      }
    }

    if (mergeStr) {
      if (mergeStr.includes("append")) mergeMode = "append";
      else if (mergeStr.includes("override")) mergeMode = "override";
      else warnings.push("로어북 Merge 값이 override/append가 아니면 현재는 무시됩니다.");
    }

    out.push({ id: `l-${out.length + 1}`, key, value, mergeMode, unlock });
    if (out.length >= 200) break;
  }
  return out.length ? out : null;
}

function parseLorebookSheetFormat(section: string, warnings: string[], ctx?: LorebookWarnCtx): PromptLorebookItem[] | null {
  // 지원 포맷(구글시트/엑셀 복붙):
  // - 탭(TSV)로 컬럼이 분리된 형태
  //   key<TAB>value<TAB>unlock<TAB>merge<TAB>cost_panana
  // - 탭이 없고, "  " (2칸 이상 공백)으로 컬럼이 분리된 형태
  // - 헤더가 "KeyValueUnlockMergecost_panana" 처럼 붙어서 들어오는 경우도 허용
  const raw = section.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const normHeader = (s: string) => s.replace(/\s+/g, "").replace(/_/g, "").toLowerCase();
  const isHeader = (l: string) => {
    const n = normHeader(l);
    return n.includes("key") && n.includes("value") && n.includes("unlock") && n.includes("merge") && n.includes("costpanana");
  };

  let startIdx = 0;
  if (isHeader(lines[0])) startIdx = 1;

  const splitRow = (l: string) => {
    if (l.includes("\t")) return l.split("\t").map((x) => x.trim()).filter((x) => x.length > 0);
    // "Key Value Unlock Merge 100" 같이 컬럼 사이 공백이 비교적 큰 경우
    const cols = l.split(/\s{2,}/g).map((x) => x.trim()).filter(Boolean);
    return cols;
  };

  const out: PromptLorebookItem[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    if (cols.length < 4) continue;

    const key = String(cols[0] || "").trim();
    const value = String(cols[1] || "").trim();
    const unlockRaw = String(cols[2] || "").trim();
    const mergeRaw = String(cols[3] || "").trim();
    const costRaw = String(cols[4] || "").trim();

    if (!key || !value) continue;

    // cost
    const mCost = /(\d+)/.exec(costRaw);
    const cost = mCost ? Number(mCost[1]) : 0;

    // unlock (parseLorebookTable과 동일 규칙)
    const unlockStr = unlockRaw.toLowerCase();
    let unlock: PromptLorebookItem["unlock"] = { type: "public" };

    const mAff = /(affection)\s*>=\s*(\d+)/i.exec(unlockRaw);
    if (mAff) {
      unlock = { type: "affection", min: Number(mAff[2]) || 0 };
    } else if (unlockStr.includes("ending_route") || unlockStr.includes("ending-route")) {
      const mKey = /ending[_-]route\s*[:=]\s*([a-z0-9_\-]+)/i.exec(unlockRaw);
      const mEp = /\bep\s*>=\s*(\d{1,3})/i.exec(unlockRaw);
      unlock = {
        type: "ending_route",
        endingKey: mKey?.[1] ? String(mKey[1]).trim() : undefined,
        epMin: mEp?.[1] ? Number(mEp[1]) || 0 : undefined,
        costPanana: cost > 0 ? cost : undefined,
      };
    } else if (unlockStr.includes("public")) {
      unlock = { type: "public" };
    } else if (unlockStr.includes("paid_item") || unlockStr.includes("paid")) {
      unlock = { type: "paid_item", sku: cost > 0 ? `PANA:${cost}` : "PANA:1000" };
    } else {
      const mCond = /([a-z_]+)\s*(>=|<=|=|<|>)\s*(\d+)/i.exec(unlockRaw);
      if (mCond) {
        const expr = `${mCond[1]}${mCond[2]}${mCond[3]}`;
        unlock = { type: "condition", expr, costPanana: cost > 0 ? cost : undefined };
      } else if (unlockRaw) {
        if (ctx) ctx.unknownUnlockRaw.add(unlockRaw);
        else warnings.push(`로어북 Unlock "${unlockRaw}"를 해석하지 못해 public으로 저장됩니다.`);
      }
    }

    // merge
    let mergeMode: PromptLorebookItem["mergeMode"] = "override";
    if (mergeRaw) {
      const m = mergeRaw.toLowerCase();
      if (m.includes("append")) mergeMode = "append";
      else if (m.includes("override")) mergeMode = "override";
      else warnings.push("로어북 Merge 값이 override/append가 아니면 현재는 무시됩니다.");
    }

    out.push({ id: `l-${out.length + 1}`, key, value, mergeMode, unlock });
    if (out.length >= 500) break;
  }

  return out.length ? out : null;
}

function parseLorebookTextFormat(section: string, warnings: string[], ctx?: LorebookWarnCtx): PromptLorebookItem[] | null {
  // 지원 포맷:
  // 1. 키
  // Value: ... (또는 "• Value: ..." 같은 불릿 포함 라인)
  // Unlock: paid_item | public | affection>=30 | trust>=70 | risk>=50 ...
  // Merge: override|append
  // Cost: 200  (또는 cost_panana: 200)
  //
  // 추가 지원(프로젝트 로어북 H 섹션에서 자주 사용):
  // Key: ...
  // Value: ...
  // Unlock: ...
  // Merge: ...
  // cost_panana: ...
  const lines = section.replace(/\r\n/g, "\n").split("\n");
  const items: Array<{
    key: string;
    value: string;
    unlockRaw: string;
    mergeRaw: string;
    cost: number;
  }> = [];

  let cur: any = null;
  const flush = () => {
    if (!cur) return;
    if (cur.key) items.push(cur);
    cur = null;
  };

  // "1.키" 처럼 공백이 없어도 허용
  const isNumberedHeader = (l: string) => /^\s*\d+\.\s*/.test(l);
  const getAfterColon = (l: string) => {
    const m = /[:：]\s*(.+)$/.exec(l);
    return m?.[1] ? String(m[1]).trim() : "";
  };
  const isKeyHeader = (l: string) => {
    const lower = l.toLowerCase();
    return lower.startsWith("key:") || lower.startsWith("key：") || l.startsWith("키:") || l.startsWith("키：");
  };

  for (const raw of lines) {
    const lRaw = raw.trim();
    if (!lRaw) continue;
    // "• Value:" / "- Value:" / "* Value:" 같은 불릿을 제거
    const l = lRaw.replace(/^[•\u2022\-\*]\s+/, "");

    // (A) 번호 헤더: "1. Key"
    if (isNumberedHeader(l)) {
      flush();
      cur = { key: l.replace(/^\s*\d+\.\s+/, "").trim(), value: "", unlockRaw: "", mergeRaw: "", cost: 0 };
      continue;
    }
    // (B) Key 헤더: "Key: ...." (프로젝트 로어북(H)에서 자주 사용)
    if (isKeyHeader(l)) {
      flush();
      cur = { key: getAfterColon(l), value: "", unlockRaw: "", mergeRaw: "", cost: 0 };
      continue;
    }
    if (!cur) continue;

    const lower = l.toLowerCase();
    if (lower.startsWith("value:") || l.startsWith("값:")) {
      cur.value = getAfterColon(l);
      continue;
    }
    if (lower.startsWith("unlock:") || l.startsWith("해금:")) {
      cur.unlockRaw = getAfterColon(l);
      continue;
    }
    if (lower.startsWith("merge:") || l.startsWith("합성:")) {
      cur.mergeRaw = getAfterColon(l);
      continue;
    }
    if (lower.startsWith("cost:") || lower.startsWith("cost_panana:") || lower.startsWith("cost panana:") || l.startsWith("비용:")) {
      const v = getAfterColon(l);
      const m = /(\d+)/.exec(v);
      cur.cost = m ? Number(m[1]) : 0;
      continue;
    }

    // Value가 여러 줄일 수도 있으니, 라벨이 아니면 value에 이어붙임
    if (!/^(unlock|merge|cost)\s*:/i.test(l)) {
      cur.value = cur.value ? `${cur.value}\n${l}` : l;
    }
  }
  flush();

  if (!items.length) return null;

  const out: PromptLorebookItem[] = [];
  for (const it of items) {
    const unlockRaw = String(it.unlockRaw || "").trim();
    const unlockLower = unlockRaw.toLowerCase();

    // unlock parsing:
    // - public
    // - paid_item (+ cost -> PANA:<cost>)
    // - affection>=N
    // - trust/risk/submission/debt...>=N -> condition(expr + optional costPanana)
    // - ending_route(옵션: ending_route:KEY / ending_route ep>=7)
    let unlock: PromptLorebookItem["unlock"] = { type: "public" };
    let mergeMode: PromptLorebookItem["mergeMode"] = "override";

    // affection>=30 같은 패턴
    const mAff = /(affection)\s*>=\s*(\d+)/i.exec(unlockRaw);
    if (mAff) {
      unlock = { type: "affection", min: Number(mAff[2]) || 0 };
    } else if (unlockLower.includes("ending_route") || unlockLower.includes("ending-route")) {
      const mKey = /ending[_-]route\s*[:=]\s*([a-z0-9_\-]+)/i.exec(unlockRaw);
      const mEp = /\bep\s*>=\s*(\d{1,3})/i.exec(unlockRaw);
      const cost = Number(it.cost) || 0;
      unlock = {
        type: "ending_route",
        endingKey: mKey?.[1] ? String(mKey[1]).trim() : undefined,
        epMin: mEp?.[1] ? Number(mEp[1]) || 0 : undefined,
        costPanana: cost > 0 ? cost : undefined,
      };
    } else if (unlockLower.includes("public")) {
      unlock = { type: "public" };
    } else if (unlockLower.includes("paid_item") || unlockLower.includes("paid")) {
      const cost = Number(it.cost) || 0;
      unlock = { type: "paid_item", sku: cost > 0 ? `PANA:${cost}` : "PANA:1000" };
    } else {
      // trust>=70 / risk>=50 / submission<20 ... 등
      const mCond = /([a-z_]+)\s*(>=|<=|=|<|>)\s*(\d+)/i.exec(unlockRaw);
      if (mCond) {
        const expr = `${mCond[1]}${mCond[2]}${mCond[3]}`;
        const cost = Number(it.cost) || 0;
        unlock = { type: "condition", expr, costPanana: cost > 0 ? cost : undefined };
      } else if (unlockRaw) {
        if (ctx) ctx.unknownUnlockRaw.add(unlockRaw);
        else warnings.push(`로어북 Unlock "${unlockRaw}"를 해석하지 못해 public으로 저장됩니다.`);
      }
    }

    if (it.mergeRaw) {
      const m = it.mergeRaw.toLowerCase();
      if (m.includes("append")) mergeMode = "append";
      else if (m.includes("override")) mergeMode = "override";
      else warnings.push("로어북 Merge 값이 override/append가 아니면 현재는 무시됩니다.");
    }

    out.push({ id: `l-${out.length + 1}`, key: it.key, value: it.value || "", mergeMode, unlock });
    if (out.length >= 400) break;
  }
  return out.length ? out : null;
}

function extractAuthorNoteFallback(secC: string) {
  // "[Author Note]" 블록 또는 "Author Note" 헤딩 블록을 최대한 넓게 수집
  const m1 =
    /\[Author Note\][\s\S]*?\n([\s\S]*?)(?=\n\s*\[(?:프리미엄|Premium)\b|\n\s*[D-G]\)\s*|$)/i.exec(secC);
  if (m1?.[1]) return m1[1].trim();
  const m2 = /Author Note[\s\S]*?\n([\s\S]*?)(?=\n\s*[D-G]\)\s*|$)/i.exec(secC);
  if (m2?.[1]) return m2[1].trim();
  return "";
}

function extractOperatorMemo(md: string) {
  // 지원:
  // - "[운영자 메모]" 섹션
  // - "운영자 메모" 헤딩
  // 다음 대문자 섹션(A)/B)/C)... 또는 문서 끝에서 종료
  const m1 = /\[운영자\s*메모\][\s\S]*?\n([\s\S]*?)(?=\n\s*[A-G]\)\s*|$)/i.exec(md);
  if (m1?.[1]) return m1[1].trim();
  const m2 = /운영자\s*메모[\s\S]*?\n([\s\S]*?)(?=\n\s*[A-G]\)\s*|$)/i.exec(md);
  if (m2?.[1]) return m2[1].trim();
  return "";
}

function extractSystemFromMarkdown(secC: string) {
  // Gemini가 # Role Definition / # Personality & Identity / # Dialogue Guidelines 등으로 주는 케이스를 흡수
  const role = extractSection(secC, /#\s*Role Definition\s*\n/i, [/^#\s+/m]) || "";
  const identity = extractSection(secC, /#\s*Personality\s*&\s*Identity\s*\n/i, [/^#\s+/m]) || "";
  const guide = extractSection(secC, /#\s*Dialogue Guidelines\s*\n/i, [/^#\s+/m]) || "";
  const rules = extractSection(secC, /#\s*Mandatory Rules[\s\S]*?\n/i, [/^#\s+/m]) || "";
  const personalitySummary = [role, identity].filter(Boolean).join("\n\n").trim();
  const speechGuide = [guide, rules].filter(Boolean).join("\n\n").trim();
  return { personalitySummary, speechGuide };
}

function extractBulletLineValue(block: string, labelRe: RegExp) {
  // 불릿("o", "•", "-", "*") + "라벨: 값" 한 줄 형태를 추출
  // 예: "o 성격: 냉혈한 신경외과 교수..."
  const lines = String(block || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  for (const raw of lines) {
    const l = raw.trim().replace(/^(?:[•\u2022\-\*]|o)\s+/i, "");
    const idx = l.search(labelRe);
    if (idx !== 0) continue;
    const m = /^(.+?)\s*[:：]\s*(.+)$/.exec(l);
    if (!m) continue;
    return String(m[2] || "").trim();
  }
  return "";
}

function extractSpeechHabitsFromMd(md: string) {
  // 지원: "말투/텍스트 습관:" 다음 줄의 o 불릿들을 수집
  const lines = String(md || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const stripTopBullet = (s: string) => s.trim().replace(/^(?:[•\u2022\-\*]|o)\s+/i, "");

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = stripTopBullet(lines[i]);
    if (/^말투\s*\/\s*텍스트\s*습관\s*:/i.test(t) || /^말투\/텍스트\s*습관\s*:/i.test(t) || /^말투\s*습관\s*:/i.test(t)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return "";

  const out: string[] = [];
  for (let i = start; i < Math.min(lines.length, start + 30); i++) {
    const raw = lines[i];
    if (!raw) break;
    const t = stripTopBullet(raw);
    // 다음 큰 섹션/헤더로 보이면 종료
    if (/^(System|Few-shot|Author Note)\s*:/i.test(t)) break;
    if (/^[A-I]\)\s*/i.test(t)) break;
    if (/^\[운영자\s*메모\]/i.test(t) || /^운영자\s*메모/i.test(t)) break;
    // 여기서는 "말투/텍스트 습관"의 하위 항목만 의미 있으므로, 'o ...' 불릿만 수집한다.
    // 다음 상위 불릿(•/-/*)이나 섹션형 라벨이 나오면 즉시 중단.
    if (/^\s*[•\u2022\-\*]\s+/i.test(raw)) break;
    const mO = /^\s*o\s+(.+)$/.exec(raw.trim());
    if (!mO) break;
    out.push(String(mO[1] || "").trim());
  }
  return out.join("\n").trim();
}

function extractIdentityBasicsBlock(md: string) {
  // 사용자 포맷 지원:
  // "1. 정체성 및 핵심 설정" 안에
  // - "성격 요약 (내용물):" 다음 줄(들)
  // - "말투 가이드:" 다음 줄(들)
  // - "핵심 욕망:" 다음 줄(들)
  const sec =
    extractSection(md, /(?:^|\n)\s*(?:1\.\s*)?정체성\s*및\s*핵심\s*설정[\s\S]*?\n/i, [
      /^\s*2\.\s*/m,
      /^\s*[A-I]\)\s*/m,
      /^\s*\[운영자\s*메모\]/m,
      /^\s*운영자\s*메모/m,
    ]) || "";
  if (!sec) return { personalitySummary: "", speechGuide: "", coreDesire: "" };

  const personalitySummary =
    extractSection(sec, /성격\s*요약[\s\S]*?:\s*\n/i, [/\n\s*말투\s*가이드\s*:/i, /\n\s*핵심\s*욕망\s*:/i, /^\s*2\.\s*/m]) || "";
  const speechGuide = extractSection(sec, /말투\s*가이드\s*:\s*\n/i, [/\n\s*핵심\s*욕망\s*:/i, /^\s*2\.\s*/m]) || "";
  const coreDesire =
    extractSection(sec, /핵심\s*욕망\s*:\s*\n/i, [/^\s*2\.\s*/m, /^\s*[A-I]\)\s*/m, /^\s*\[운영자\s*메모\]/m, /^\s*운영자\s*메모/m]) || "";

  return {
    personalitySummary: personalitySummary.trim(),
    speechGuide: speechGuide.trim(),
    coreDesire: coreDesire.trim(),
  };
}

function parseTriggersFromMarkdown(section: string, warnings: string[]): TriggerRulesPayload | null {
  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // 지원 패턴:
  // - "IF: ... THEN: ..."
  // - "- IF ... THEN ..."
  // - "조건: ... / 결과: ..."
  const rules: any[] = [];

  const textIncludes = (text: string): string[] => {
    // 따옴표/대괄호/쉼표로 키워드 추출
    const quoted = Array.from(text.matchAll(/["'“”‘’]([^"'“”‘’]+)["'“”‘’]/g)).map((m) => String(m[1]).trim());
    if (quoted.length) return quoted.filter(Boolean).slice(0, 8);
    const bracket = Array.from(text.matchAll(/\[([^\]]+)\]/g))
      .flatMap((m) => String(m[1]).split(/[,\s]+/g))
      .map((x) => x.trim())
      .filter(Boolean);
    if (bracket.length) return bracket.slice(0, 8);
    const loose = text
      .split(/[,\s]+/g)
      .map((x) => x.trim())
      .filter((x) => x.length >= 2 && x.length <= 12);
    return loose.slice(0, 6);
  };

  const parseIf = (s: string) => {
    const lowerAll = s.toLowerCase();
    const isOr = /\s+OR\s+| 또는 /i.test(s);
    const joinType: "AND" | "OR" = isOr ? "OR" : "AND";
    const parts = s.split(/\s+(?:AND|OR)\s+| 그리고 | 또는 /i).map((x) => x.trim()).filter(Boolean);
    const conditions: any[] = [];

    for (const part of (parts.length ? parts : [s])) {
      const lower = part.toLowerCase();

      // 미접속 시간
      const mInactive = /(미접속|inactive)\s*([0-9]{1,3})\s*(시간|hours)/i.exec(part);
      if (mInactive) {
        conditions.push({ type: "inactive_time", hours: Number(mInactive[2]) || 24 });
        continue;
      }

      // 변수 비교: affection >= 30 등 (<= >=는 현재 타입 제약상 < >로 근사)
      const mVar =
        /(affection|jealousy|trust|danger|guilt|exposurerisk|dependency|secretlevel|risk|submission|debt|suspicion|sales)\s*(<=|>=|=|<|>)\s*([0-9]{1,12})/i.exec(
          lower,
        );
      if (mVar) {
        const opRaw = mVar[2];
        const op = opRaw === "<=" ? "<" : opRaw === ">=" ? ">" : (opRaw as any);
        conditions.push({ type: "variable_compare", var: mVar[1], op, value: Number(mVar[3]) || 0 });
        continue;
      }

      // Location == "호텔" 같은 문자열 비교는 text_includes로 근사
      const mLoc = /(location|위치)\s*(==|=)\s*["'“”]?([^"'“”]+)["'“”]?/i.exec(part);
      if (mLoc) {
        const v = String(mLoc[3] || "").trim();
        if (v) {
          conditions.push({ type: "text_includes", values: [v].slice(0, 1) });
          continue;
        }
      }

      // 텍스트 포함(키워드)
      if (lower.includes("포함") || lower.includes("includes") || /["'“”‘’]/.test(part) || /\[[^\]]+\]/.test(part)) {
        const values = textIncludes(part);
        if (values.length) {
          conditions.push({ type: "text_includes", values });
          continue;
        }
      }
    }

    if (!conditions.length) {
      const values = textIncludes(s);
      if (values.length) conditions.push({ type: "text_includes", values });
    }
    return { type: joinType, conditions };
  };

  const parseThen = (s: string) => {
    const actions: any[] = [];
    const lower = s.toLowerCase();

    // 변수 증감: "affection +5", "질투 +10"
    const varMap: Record<string, string> = {
      "호감도": "affection",
      "호감": "affection",
      "질투": "jealousy",
      "신뢰": "trust",
      "위험": "danger",
      "죄책감": "guilt",
      "노출": "exposureRisk",
      "의존": "dependency",
      "비밀": "secretLevel",
    };
    const mKor = /(호감도|호감|질투|신뢰|위험|죄책감|노출|의존|비밀)\s*([+-])\s*([0-9]{1,3})/i.exec(s);
    if (mKor) actions.push({ type: "variable_mod", var: varMap[mKor[1]] || "affection", op: mKor[2], value: Number(mKor[3]) || 0 });

    const mEng = /(affection|jealousy|trust|danger|guilt|exposurerisk|dependency|secretlevel)\s*([+-])\s*([0-9]{1,3})/i.exec(lower);
    if (mEng) actions.push({ type: "variable_mod", var: mEng[1], op: mEng[2], value: Number(mEng[3]) || 0 });

    // join/leave 등 지시어가 들어있으면 가능한 액션으로 분해(Studio UI에서도 그대로 편집 가능)
    const ev = parseDirectiveText(s);
    for (const e of ev) {
      if (e.type === "join") actions.push({ type: "join", name: e.name });
      else if (e.type === "leave") actions.push({ type: "leave", name: e.name });
      else if (e.type === "system_message") actions.push({ type: "system_message", text: e.text });
    }

    // 시스템 메시지(기본)
    if (!actions.length) {
      if (s.includes("[시스템]") || s.includes("[알림]")) actions.push({ type: "system_message", text: s.trim() });
      else if (lower.includes("시스템") || lower.includes("system") || s.includes("알림")) actions.push({ type: "system_message", text: `[시스템] ${s.trim()}` });
      else actions.push({ type: "system_message", text: `[시스템] ${s.trim()}` });
    }
    return { actions };
  };

  const joined = lines.join("\n");
  const re = /(IF|조건)\s*[:：]\s*([\s\S]*?)\s*(THEN|결과)\s*[:：]\s*([\s\S]*?)(?=\n\s*(IF|조건)\s*[:：]|$)/gi;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(joined))) {
    idx++;
    const ifPart = String(m[2] || "").trim();
    const thenPart = String(m[4] || "").trim();
    rules.push({
      id: `rule_${Date.now()}_${idx}`,
      name: `Imported Rule ${idx}`,
      enabled: true,
      if: parseIf(ifPart),
      then: parseThen(thenPart),
    });
    if (rules.length >= 60) break;
  }

  // 콜론 없는 한 줄 포맷 지원:
  // - "IF Risk > 80 THEN ..."
  // - "1. IF ... THEN ..."
  // - "• IF ... THEN ..."
  if (!rules.length) {
    let idx2 = 0;
    for (const raw of lines) {
      const line = raw.replace(/^[•\u2022\-\*]\s+/, "").replace(/^\d+\.\s+/, "").trim();
      const mm = /\bIF\s+(.+?)\s+\bTHEN\s+(.+)$/i.exec(line);
      if (!mm) continue;
      idx2++;
      const ifPart = String(mm[1] || "").trim();
      const thenPart = String(mm[2] || "").trim();
      rules.push({
        id: `rule_${Date.now()}_${idx2}`,
        name: `Imported Rule ${idx2}`,
        enabled: true,
        if: parseIf(ifPart),
        then: parseThen(thenPart),
      });
      if (rules.length >= 60) break;
    }
  }

  // 멀티라인/THEN 뒤 콜론/줄바꿈 케이스를 폭넓게 지원:
  // - "IF ... THEN :" 다음 줄에 메시지가 오는 경우
  // - THEN 뒤에 ":"가 붙는 경우
  // - 번호/불릿이 섞여도 동작
  if (!rules.length) {
    let idx3 = 0;
    const blob = section
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.replace(/^[•\u2022\-\*]\s+/, "").replace(/^\d+\.\s+/, "").trim())
      .filter(Boolean)
      .join("\n");

    const re2 = /\bIF\s+([\s\S]*?)\s+\bTHEN\s*:?\s*([\s\S]*?)(?=\n\s*(?:\d+\.\s*)?\bIF\b|\n\s*$)/gi;
    let mm2: RegExpExecArray | null;
    while ((mm2 = re2.exec(blob))) {
      idx3++;
      const ifPart = String(mm2[1] || "").trim();
      const thenPart = String(mm2[2] || "").trim();
      if (!ifPart || !thenPart) continue;
      rules.push({
        id: `rule_${Date.now()}_${idx3}`,
        name: `Imported Rule ${idx3}`,
        enabled: true,
        if: parseIf(ifPart),
        then: parseThen(thenPart),
      });
      if (rules.length >= 60) break;
    }
  }

  if (!rules.length) {
    warnings.push("변수/트리거 섹션에서 IF/THEN 트리거를 찾지 못했어요. (예: 'IF ... THEN ...' 형태 권장)");
    return null;
  }
  return { rules } as TriggerRulesPayload;
}

function parseProjectScenesFromMarkdown(md: string) {
  // 지원 포맷:
  // "3) 드라마 씬 기반" 아래에
  // "• EP1: 을의 연애 (병원 로비) -> 해고 위기 -> 무료"
  // ...
  const text = String(md || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n");
  const stripTop = (s: string) => s.trim().replace(/^(?:[•\u2022\-\*]|o)\s+/i, "");

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = stripTop(lines[i]);
    if (/^3\)\s*드라마\s*씬\s*기반/i.test(t) || /^3\)\s*드라마\s*씬/i.test(t)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;

  const out: Array<{
    slug: string;
    title: string;
    episodeLabel: string;
    groupChatEnabled: boolean;
    seedLorebookValue?: string;
    seedRules?: TriggerRulesPayload;
  }> =
    [];
  for (let i = start; i < Math.min(lines.length, start + 40); i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const t = stripTop(raw);
    // 다음 섹션으로 넘어가면 종료
    if (/^[C-I]\)\s*/i.test(t)) break;
    if (/^\[운영자\s*메모\]/i.test(t) || /^운영자\s*메모/i.test(t)) break;

    const m = /^EP\s*([0-9]{1,3})\s*:\s*(.+)$/i.exec(t);
    if (!m) continue;
    const n = Number(m[1]) || 0;
    const episodeLabel = `EP${n}`;
    const rest = String(m[2] || "").trim();
    // title은 "(" 또는 "->" 이전까지
    const cutIdx = (() => {
      const a = rest.indexOf("(");
      const b = rest.indexOf("->");
      const cands = [a, b].filter((x) => x >= 0);
      return cands.length ? Math.min(...cands) : -1;
    })();
    const title = (cutIdx >= 0 ? rest.slice(0, cutIdx) : rest).trim();
    const loc = /\(([^)]+)\)/.exec(rest)?.[1]?.trim() || "";
    const arrowParts = rest
      .split("->")
      .map((x) => x.trim())
      .filter(Boolean);
    // 첫 항목은 title(+location) 파트, 뒤는 요약/비용 등
    const conflict = arrowParts[1] || "";
    const cost = arrowParts[2] || "";

    const seedLorebookValue = [
      loc ? `장소: ${loc}` : "",
      conflict ? `요약: ${conflict}` : "",
      cost ? `비용: ${cost}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .trim();
    const slug = `ep${n || out.length + 1}`;
    out.push({
      slug,
      title: title || episodeLabel,
      episodeLabel,
      groupChatEnabled: true,
      seedLorebookValue: seedLorebookValue || undefined,
    });
  }

  // join/leave 이벤트(1:N 변환)에서 룰 초안 생성 (씬별로 동일하게 붙이되, EP 요약 룰과 함께 들어가게 해서 차이를 유지)
  const joinLeave = (() => {
    const text = String(md || "");
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const strip = (s: string) => s.trim().replace(/^(?:[•\u2022\-\*]|o)\s+/i, "");
    const collect = (headerRe: RegExp, max = 20) => {
      let start = -1;
      for (let i = 0; i < lines.length; i++) {
        const t = strip(lines[i]);
        if (headerRe.test(t)) {
          start = i + 1;
          break;
        }
      }
      if (start === -1) return [] as string[];
      const out: string[] = [];
      for (let i = start; i < Math.min(lines.length, start + 80); i++) {
        const raw = lines[i];
        if (!raw.trim()) break;
        const t = strip(raw);
        if (/^(leave\s*이벤트|join\s*이벤트|등장인물\s*소환\s*장치)\b/i.test(t)) break;
        if (/^[C-I]\)\s*/i.test(t)) break;
        if (/^\[운영자\s*메모\]/i.test(t) || /^운영자\s*메모/i.test(t)) break;
        if (/^o\s+/i.test(raw.trim())) {
          out.push(strip(raw));
          if (out.length >= max) break;
        } else if (/^[•\u2022\-\*]\s+/.test(raw.trim())) {
          break;
        } else {
          // 라인 패턴이 깨지면 종료(과수집 방지)
          break;
        }
      }
      return out;
    };
    const joins = collect(/join\s*이벤트/i, 12);
    const leaves = collect(/leave\s*이벤트/i, 12);
    return { joins, leaves };
  })();

  const makeSeedRules = (scene: (typeof out)[number]) => {
    const rules: any[] = [];
    const keywords = [
      scene.episodeLabel,
      scene.title,
      // loc/요약에서 키워드 일부를 추출(간단히)
      ...String(scene.seedLorebookValue || "")
        .split(/[\n:]/g)
        .map((x) => x.trim())
        .filter((x) => x.length >= 2 && x.length <= 12),
    ].filter(Boolean);
    rules.push({
      id: `seed_${scene.slug}_summary`,
      name: `${scene.episodeLabel} 요약`,
      enabled: true,
      if: { type: "AND", conditions: [{ type: "text_includes", values: Array.from(new Set(keywords)).slice(0, 6) }] },
      then: { actions: [{ type: "system_message", text: `[씬] ${scene.episodeLabel} · ${scene.title}\n${scene.seedLorebookValue || ""}` }] },
    });

    // join/leave 이벤트를 룰 초안으로 추가(동작 엔진이 아직 join/leave를 실행하진 않지만, 작가가 편집할 기반 제공)
    const addEventRules = (items: string[], prefix: string) => {
      let idx = 0;
      for (const line of items) {
        idx++;
        // [연구실] 민 교수 등장: "..."
        const bracket = /\[([^\]]+)\]/.exec(line)?.[1]?.trim() || "";
        const who = /]\s*([^:]+?)\s*(?:등장|퇴장|난입)/.exec(line)?.[1]?.trim() || "";
        const q = /"([^"]+)"/.exec(line)?.[1]?.trim() || "";
        const values = Array.from(new Set([bracket, who].filter(Boolean))).slice(0, 3);
        if (!values.length) continue;
        rules.push({
          id: `seed_${scene.slug}_${prefix}_${idx}`,
          name: `${prefix.toUpperCase()} 이벤트 ${idx}${who ? `: ${who}` : ""}`,
          enabled: true,
          if: { type: "AND", conditions: [{ type: "text_includes", values }] },
          then: { actions: [{ type: "system_message", text: `[${prefix.toUpperCase()} 이벤트] ${line}${q ? `\n"${q}"` : ""}` }] },
        });
        if (rules.length >= 12) break;
      }
    };
    addEventRules(joinLeave.joins, "join");
    addEventRules(joinLeave.leaves, "leave");
    return { rules } as TriggerRulesPayload;
  };

  for (const s of out) {
    s.seedRules = makeSeedRules(s);
  }

  return out.length ? out : null;
}

export function parseStudioMarkdownImport(markdown: string): StudioImportResult {
  const md = normalize(markdown || "");
  const warnings: string[] = [];
  const lorebookWarnCtx: LorebookWarnCtx = {
    unknownUnlockRaw: new Set<string>(),
  };

  // C) 핵심 욕망(Core Desire) 섹션 지원
  const secCoreDesire =
    extractSection(md, /C\)\s*(?:핵심\s*욕망|Core\s*Desire)[\s\S]*?\n/i, [
      /^\s*D\)\s*/m,
      /^\s*E\)\s*/m,
      /^\s*F\)\s*/m,
      /^\s*G\)\s*/m,
      /^\s*H\)\s*/m,
      /^\s*I\)\s*/m,
    ]) ||
    // 과거 문서 호환(잘못된 라벨로도 들어오는 케이스)
    extractSection(md, /C\)\s*시스템\s*프롬프트[\s\S]*?\n/i, [/^\s*D\)\s*/m, /^\s*E\)\s*/m, /^\s*F\)\s*/m, /^\s*G\)\s*/m]) ||
    extractSection(md, /C\)\s*시스템[\s\S]*?\n/i, [/^\s*D\)\s*/m, /^\s*E\)\s*/m, /^\s*F\)\s*/m, /^\s*G\)\s*/m]) ||
    "";

  // D) 시스템 프롬프트(3-Layer) 블록을 우선 파싱 (여기에 System/Few-shot/Author Note가 들어있는 케이스 대응)
  const secSystemLayer =
    extractSection(md, /D\)\s*시스템\s*프롬프트[\s\S]*?\n/i, [/^\s*E\)\s*/m, /^\s*F\)\s*/m, /^\s*G\)\s*/m]) ||
    extractSection(md, /D\)\s*시스템[\s\S]*?\n/i, [/^\s*E\)\s*/m, /^\s*F\)\s*/m, /^\s*G\)\s*/m]) ||
    "";

  const systemBlock = secSystemLayer || secCoreDesire || "";

  const fewShotPairs = parseFewShotPairs(systemBlock || md);
  if (!fewShotPairs.length) warnings.push("Few-shot(USER/ASSISTANT) 쌍을 찾지 못했어요. (예: 'USER: ...' 다음 줄에 'ASSISTANT: ...')");

  const identityBasics = extractIdentityBasicsBlock(md);

  // System 필드(유연하게)
  const fallbackSys = extractSystemFromMarkdown(systemBlock);
  const personalitySummaryRaw =
    extractField(systemBlock, "성격/정체성 요약") ||
    extractField(systemBlock, "성격") ||
    extractField(systemBlock, "정체성") ||
    identityBasics.personalitySummary ||
    fallbackSys.personalitySummary;
  const speechGuideRaw =
    extractField(systemBlock, "말투 가이드") ||
    extractField(systemBlock, "말투") ||
    identityBasics.speechGuide ||
    fallbackSys.speechGuide;

  // 불릿 형태(System: 아래에 o 성격:/o 규칙:/o 말투:) 보강
  const personalitySummary =
    personalitySummaryRaw ||
    extractBulletLineValue(
      systemBlock,
      /^(?:성격\s*\/\s*정체성\s*요약|성격\/정체성\s*요약|성격\s*\/\s*정체성|성격\/정체성|성격\s*요약|성격|정체성)\s*[:：]/i,
    ) ||
    "";
  const habits = extractSpeechHabitsFromMd(md);
  const toneLine = extractBulletLineValue(systemBlock, /^(말투\s*가이드|말투)\s*[:：]/i);
  const rulesLine = extractBulletLineValue(systemBlock, /^(규칙)\s*[:：]/i);

  // A안: 규칙은 말투 가이드에 두되, "규칙:" 섹션으로 분리해서 가독성 확보
  const baseSpeech =
    speechGuideRaw ||
    [toneLine, habits].filter(Boolean).join("\n") ||
    "";
  const speechGuide =
    rulesLine && !baseSpeech.includes(rulesLine)
      ? [baseSpeech, `규칙:\n${rulesLine}`].filter(Boolean).join("\n\n")
      : baseSpeech;

  // 핵심 욕망: D) 블록에 명시 필드가 없고 C)에 서술형으로만 있을 수 있으므로 보강
  const coreDesire =
    extractField(systemBlock, "핵심 욕망") ||
    extractField(systemBlock, "핵심 욕망\\(Core Desire\\)") ||
    extractField(systemBlock, "Core Desire") ||
    extractField(systemBlock, "욕망") ||
    // D) 블록 안에 "C) 핵심 욕망"이 포함된 경우에도 추출
    extractSection(systemBlock, /(?:^|\n)\s*C\)\s*(?:핵심\s*욕망|Core\s*Desire)[\s\S]*?\n/i, [
      /^\s*D\)\s*/m,
      /^\s*E\)\s*/m,
      /^\s*F\)\s*/m,
      /^\s*G\)\s*/m,
      /^\s*H\)\s*/m,
      /^\s*I\)\s*/m,
      /^\s*\[운영자\s*메모\]/m,
      /^\s*운영자\s*메모/m,
    ]) ||
    identityBasics.coreDesire ||
    (secCoreDesire ? secCoreDesire.trim() : "");

  const authorNote =
    extractField(systemBlock, "Author Note") ||
    extractField(systemBlock, "오서 노트") ||
    extractField(systemBlock, "최종 지시") ||
    extractAuthorNoteFallback(systemBlock) ||
    "";

  const promptPatch: Partial<StudioPromptState> = {
    system: {
      personalitySummary: personalitySummary || "",
      speechGuide: speechGuide || "",
      coreDesire: coreDesire || "",
      fewShotPairs,
    },
    author: {
      forceBracketNarration: true,
      shortLongLimit: false,
      nsfwFilterOff: false,
      authorNote: authorNote || "",
    },
  };

  // 운영자 메모(선택): 어디서든 찾을 수 있도록 전체 md에서 추출
  const operatorMemo = extractOperatorMemo(md);
  if (operatorMemo) {
    promptPatch.meta = { operatorMemo };
  }

  const publicProfile = extractPublicProfile(md);

  // D) 로어북
  const secD =
    extractSection(md, /D\)\s*로어북[\s\S]*?\n/i, [/^\s*E\)\s*/m, /^\s*F\)\s*/m, /^\s*G\)\s*/m]) ||
    // 사용자 케이스: E) 로어북
    extractSection(md, /E\)\s*로어북[\s\S]*?\n/i, [/^\s*F\)\s*/m, /^\s*G\)\s*/m]) ||
    "";
  const loreSource = secD || (md.toLowerCase().includes("로어북") ? md.slice(Math.max(0, md.toLowerCase().indexOf("로어북") - 20)) : md);
  const lorebook =
    parseLorebookTable(loreSource, warnings, lorebookWarnCtx) ||
    parseLorebookTextFormat(loreSource, warnings, lorebookWarnCtx) ||
    parseLorebookSheetFormat(loreSource, warnings, lorebookWarnCtx);
  if (!lorebook) warnings.push("로어북을 찾지 못했어요. (Markdown 표 또는 Text Format: 1. key + Value/Unlock/Merge/Cost)");

  // E) 트리거: JSON 블록 우선, 없으면 마크다운에서 IF/THEN 자동 추출
  // ⚠️ 주의: /E\)\s*/ 같은 과도하게 넓은 fallback은 "E) 로어북"을 트리거 섹션으로 오인할 수 있어 제거.
  // 트리거 섹션은 반드시 "변수" + "트리거" 키워드를 포함하는 E)/F) 라벨로만 추출한다.
  const secE =
    extractSection(md, /E\)\s*변수[\s\S]*?트리거[\s\S]*?\n/i, [/^\s*F\)\s*/m, /^\s*G\)\s*/m]) ||
    // 사용자 케이스: F) 변수 & IF-THEN 트리거
    extractSection(md, /F\)\s*변수[\s\S]*?트리거[\s\S]*?\n/i, [/^\s*G\)\s*/m]) ||
    "";
  const json = extractFirstJsonCodeBlock(md);
  let triggers: TriggerRulesPayload | null = null;
  if (json && typeof json === "object" && Array.isArray((json as any).rules)) {
    triggers = json as TriggerRulesPayload;
  } else {
    const triggerSource = secE || (md.toLowerCase().includes("if ") ? md : md);
    triggers = parseTriggersFromMarkdown(triggerSource, warnings);
  }

  // H) 프로젝트 로어북 / I) 프로젝트 룰 (전역 IF-THEN)
  const secH =
    extractSection(md, /H\)\s*프로젝트\s*로어북[\s\S]*?\n/i, [/^\s*I\)\s*/m, /^\s*\[운영자\s*메모\]/m, /^\s*운영자\s*메모/m]) || "";
  const projectLorebook =
    (secH
      ? parseLorebookTable(secH, warnings, lorebookWarnCtx) ||
        parseLorebookTextFormat(secH, warnings, lorebookWarnCtx) ||
        parseLorebookSheetFormat(secH, warnings, lorebookWarnCtx)
      : null) || null;

  const secI =
    extractSection(md, /I\)\s*프로젝트\s*룰[\s\S]*?\n/i, [/^\s*\[운영자\s*메모\]/m, /^\s*운영자\s*메모/m]) || "";
  const projectRules = secI ? parseTriggersFromMarkdown(secI, warnings) : null;

  const projectScenes = parseProjectScenesFromMarkdown(md);

  pushUnknownUnlockSummary(warnings, lorebookWarnCtx);

  return {
    ok: true,
    warnings: dedupeWarnings(warnings),
    promptPatch,
    lorebook,
    triggers,
    projectLorebook,
    projectRules,
    publicProfile,
    projectScenes,
  };
}

