export type MyChatItem = {
  characterSlug: string;
  characterName: string;
  avatarUrl?: string;
  lastAt: number; // epoch ms
  unread?: number;
};

const LS_KEY = "panana_my_chats_v1";
const MAX_ITEMS = 50;

function safeParse(json: string): any {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function loadMyChats(): MyChatItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = safeParse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        characterSlug: String(x?.characterSlug || "").trim(),
        characterName: String(x?.characterName || "").trim(),
        avatarUrl: x?.avatarUrl ? String(x.avatarUrl) : undefined,
        lastAt: Number(x?.lastAt) || 0,
        unread: x?.unread == null ? undefined : Number(x.unread) || 0,
      }))
      .filter((x) => x.characterSlug && x.characterName)
      .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function saveMyChats(items: MyChatItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {}
}

export function recordMyChat(args: { characterSlug: string; characterName: string; avatarUrl?: string }) {
  if (typeof window === "undefined") return;
  const slug = String(args.characterSlug || "").trim();
  const name = String(args.characterName || "").trim();
  if (!slug || !name) return;

  const now = Date.now();
  const prev = loadMyChats();
  const next: MyChatItem[] = [];

  // upsert + move to top
  const existing = prev.find((x) => x.characterSlug === slug);
  next.push({
    characterSlug: slug,
    characterName: name,
    avatarUrl: args.avatarUrl || existing?.avatarUrl,
    lastAt: now,
    unread: existing?.unread,
  });
  for (const it of prev) {
    if (it.characterSlug === slug) continue;
    next.push(it);
  }
  saveMyChats(next);
}

