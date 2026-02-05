export type ChatHistoryMsg = {
  id: string;
  from: "bot" | "user" | "system";
  text: string;
  at: number; // epoch ms
  sceneImageUrl?: string;
};

export type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
};

const MAX_MSGS = 120;
const DEFAULT_THREAD_ID = "default";

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function baseKey(pananaId: string, characterSlug: string) {
  const pid = String(pananaId || "").trim() || "anon";
  const slug = String(characterSlug || "").trim().toLowerCase() || "unknown";
  return { pid, slug, prefix: `panana_chat_history_v1:${pid}:${slug}` };
}

function messagesKey(pananaId: string, characterSlug: string, threadId?: string) {
  const { prefix } = baseKey(pananaId, characterSlug);
  const tid = String(threadId || "").trim() || DEFAULT_THREAD_ID;
  return tid === DEFAULT_THREAD_ID ? prefix : `${prefix}:${tid}`;
}

function threadListKey(pananaId: string, characterSlug: string) {
  const { pid, slug } = baseKey(pananaId, characterSlug);
  return `panana_chat_threads_v1:${pid}:${slug}`;
}

/** @deprecated use messagesKey */
function key(pananaId: string, characterSlug: string) {
  return messagesKey(pananaId, characterSlug, DEFAULT_THREAD_ID);
}

export function getThreadList(args: { pananaId: string; characterSlug: string }): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(threadListKey(args.pananaId, args.characterSlug));
    if (!raw) return [];
    const parsed = safeParse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t: any) => ({
        id: String(t?.id || ""),
        title: String(t?.title || "").trim() || "대화",
        updatedAt: Number(t?.updatedAt) || 0,
      }))
      .filter((t) => t.id);
  } catch {
    return [];
  }
}

export function setThreadList(args: { pananaId: string; characterSlug: string; threads: ChatThread[] }) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(threadListKey(args.pananaId, args.characterSlug), JSON.stringify(args.threads));
  } catch {}
}

export function addThread(args: {
  pananaId: string;
  characterSlug: string;
  threadId: string;
  title?: string;
}): void {
  const list = getThreadList({ pananaId: args.pananaId, characterSlug: args.characterSlug });
  if (list.some((t) => t.id === args.threadId)) return;
  const now = Date.now();
  list.unshift({
    id: args.threadId,
    title: String(args.title || "").trim() || "새 대화",
    updatedAt: now,
  });
  setThreadList({ pananaId: args.pananaId, characterSlug: args.characterSlug, threads: list });
}

export function updateThreadTitle(args: {
  pananaId: string;
  characterSlug: string;
  threadId: string;
  title: string;
}): void {
  const list = getThreadList({ pananaId: args.pananaId, characterSlug: args.characterSlug });
  const i = list.findIndex((t) => t.id === args.threadId);
  if (i === -1) return;
  list[i] = { ...list[i], title: String(args.title || "").trim() || "대화", updatedAt: Date.now() };
  setThreadList({ pananaId: args.pananaId, characterSlug: args.characterSlug, threads: list });
}

export function setThreadUpdated(args: { pananaId: string; characterSlug: string; threadId: string; title?: string }) {
  const list = getThreadList({ pananaId: args.pananaId, characterSlug: args.characterSlug });
  const i = list.findIndex((t) => t.id === args.threadId);
  const now = Date.now();
  const title = String(args.title || "").trim();
  if (i >= 0) {
    list[i] = { ...list[i], updatedAt: now, ...(title ? { title } : {}) };
  } else {
    list.unshift({ id: args.threadId, title: title || "새 대화", updatedAt: now });
  }
  setThreadList({ pananaId: args.pananaId, characterSlug: args.characterSlug, threads: list });
}

export function loadChatHistory(args: {
  pananaId: string;
  characterSlug: string;
  threadId?: string;
}): ChatHistoryMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const k = messagesKey(args.pananaId, args.characterSlug, args.threadId);
    const raw = window.localStorage.getItem(k);
    if (!raw) return [];
    const parsed = safeParse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((m) => ({
        id: String(m?.id || ""),
        from: m?.from === "bot" || m?.from === "user" || m?.from === "system" ? m.from : "system",
        text: String(m?.text || ""),
        at: Number(m?.at) || 0,
        sceneImageUrl: m?.sceneImageUrl ? String(m.sceneImageUrl).trim() : undefined,
      }))
      .filter((m) => m.id && m.text)
      .slice(-MAX_MSGS);
  } catch {
    return [];
  }
}

export function saveChatHistory(args: {
  pananaId: string;
  characterSlug: string;
  messages: ChatHistoryMsg[];
  threadId?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = (args.messages || []).slice(-MAX_MSGS);
    const k = messagesKey(args.pananaId, args.characterSlug, args.threadId);
    window.localStorage.setItem(k, JSON.stringify(trimmed));
  } catch {}
}

/** 현재 열린 스레드가 DB와 동기화되는 기본 스레드인지 (default만 DB sync) */
export function isDefaultThread(threadId?: string): boolean {
  const tid = String(threadId || "").trim();
  return tid === "" || tid === DEFAULT_THREAD_ID;
}

