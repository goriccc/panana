import { getBrowserSupabase } from "@/lib/supabase/browser";
import { ensurePananaIdentity } from "@/lib/pananaApp/identity";
import { fetchIdentityThrottled } from "@/lib/pananaApp/identityApi";

export type MyUserProfile = {
  userId: string;
  nickname: string;
};

const CACHE_KEY = "panana_fetchMyUserProfile";
const CACHE_TTL_MS = 2 * 60 * 1000;

function getCached(): MyUserProfile | null {
  try {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(CACHE_KEY) : null;
    if (!raw) return null;
    const { data, exp } = JSON.parse(raw) as { data: MyUserProfile; exp: number };
    if (Date.now() > exp) return null;
    return data;
  } catch {
    return null;
  }
}

function setCached(p: MyUserProfile) {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: p, exp: Date.now() + CACHE_TTL_MS }));
    }
  } catch {
    // ignore
  }
}

export async function fetchMyUserProfile(): Promise<MyUserProfile | null> {
  const cached = getCached();
  if (cached) return cached;

  try {
    const data = await fetchIdentityThrottled(ensurePananaIdentity().id);
    if (data?.nickname) {
      const out: MyUserProfile = { userId: data.id, nickname: data.nickname };
      setCached(out);
      return out;
    }
  } catch {
    // ignore
  }

  const supabase = getBrowserSupabase();
  const { data: u } = await supabase.auth.getUser();
  const userId = u?.user?.id ? String(u.user.id) : "";
  if (!userId) return null;

  const { data, error } = await supabase
    .from("panana_user_profiles")
    .select("user_id, nickname")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // 테이블 미생성/권한 문제 등은 조용히 null 처리(UX 우선)
    return null;
  }
  if (!data?.user_id) return null;

  return {
    userId: String(data.user_id),
    nickname: String(data.nickname || ""),
  };
}

export async function upsertMyUserNickname(nickname: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const nick = String(nickname || "").trim().slice(0, 10);
  if (!nick) return { ok: false, error: "닉네임을 입력해 주세요." };

  // NextAuth 기반에서도 DB 저장되게 서버 API로 처리
  try {
    const idt = ensurePananaIdentity();
    const res = await fetch("/api/me/nickname", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: nick, pananaId: idt.id }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return { ok: false, error: String(data?.error || "저장에 실패했어요.") };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "저장에 실패했어요." };
  }
}

