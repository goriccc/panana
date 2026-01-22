import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { ChatRuntimeState } from "@/lib/studio/chatRuntimeEngine";

const storageKey = (characterSlug: string) => `panana_chat_runtime:${characterSlug}`;

export function loadLocalRuntime(characterSlug: string): ChatRuntimeState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(characterSlug));
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object") return null;
    return {
      variables: (j as any).variables && typeof (j as any).variables === "object" ? (j as any).variables : {},
      participants: Array.isArray((j as any).participants) ? (j as any).participants : [],
      lastActiveAt: (j as any).lastActiveAt ? String((j as any).lastActiveAt) : null,
      firedAt: (j as any).firedAt && typeof (j as any).firedAt === "object" ? (j as any).firedAt : {},
    };
  } catch {
    return null;
  }
}

export function saveLocalRuntime(characterSlug: string, state: ChatRuntimeState) {
  try {
    window.localStorage.setItem(storageKey(characterSlug), JSON.stringify(state));
  } catch {}
}

export async function loadRuntime(characterSlug: string): Promise<ChatRuntimeState | null> {
  // 로컬 우선
  if (typeof window !== "undefined") {
    const local = loadLocalRuntime(characterSlug);
    if (local) return local;
  }

  const supabase = getBrowserSupabase();
  const { data: u } = await supabase.auth.getUser();
  const userId = u?.user?.id ? String(u.user.id) : "";
  if (!userId) return null;

  const { data, error } = await supabase
    .from("panana_chat_runtime_states")
    .select("variables, participants, last_active_at")
    .eq("user_id", userId)
    .eq("character_slug", characterSlug)
    .maybeSingle();
  if (error || !data) return null;

  return {
    variables: (data as any).variables || {},
    participants: Array.isArray((data as any).participants) ? (data as any).participants : [],
    lastActiveAt: (data as any).last_active_at ? new Date(String((data as any).last_active_at)).toISOString() : null,
    firedAt: {},
  };
}

export async function saveRuntime(characterSlug: string, state: ChatRuntimeState) {
  // 로컬은 항상 저장
  if (typeof window !== "undefined") saveLocalRuntime(characterSlug, state);

  const supabase = getBrowserSupabase();
  const { data: u } = await supabase.auth.getUser();
  const userId = u?.user?.id ? String(u.user.id) : "";
  if (!userId) return;

  await supabase.from("panana_chat_runtime_states").upsert(
    {
      user_id: userId,
      character_slug: characterSlug,
      variables: state.variables || {},
      participants: state.participants || [],
      last_active_at: state.lastActiveAt ? new Date(state.lastActiveAt).toISOString() : null,
    },
    { onConflict: "user_id,character_slug" }
  );
}

