export type ChatHistoryMsg = {
  id: string;
  from: "bot" | "user" | "system";
  text: string;
  at: number; // epoch ms
};

const MAX_MSGS = 120;

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function key(pananaId: string, characterSlug: string) {
  const pid = String(pananaId || "").trim() || "anon";
  const slug = String(characterSlug || "").trim().toLowerCase() || "unknown";
  return `panana_chat_history_v1:${pid}:${slug}`;
}

export function loadChatHistory(args: { pananaId: string; characterSlug: string }): ChatHistoryMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(args.pananaId, args.characterSlug));
    if (!raw) return [];
    const parsed = safeParse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((m) => ({
        id: String(m?.id || ""),
        from: m?.from === "bot" || m?.from === "user" || m?.from === "system" ? m.from : "system",
        text: String(m?.text || ""),
        at: Number(m?.at) || 0,
      }))
      .filter((m) => m.id && m.text)
      .slice(-MAX_MSGS);
  } catch {
    return [];
  }
}

export function saveChatHistory(args: { pananaId: string; characterSlug: string; messages: ChatHistoryMsg[] }) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = (args.messages || []).slice(-MAX_MSGS);
    window.localStorage.setItem(key(args.pananaId, args.characterSlug), JSON.stringify(trimmed));
  } catch {}
}

