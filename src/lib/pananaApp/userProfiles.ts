import { getBrowserSupabase } from "@/lib/supabase/browser";

export type MyUserProfile = {
  userId: string;
  nickname: string;
};

export async function fetchMyUserProfile(): Promise<MyUserProfile | null> {
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
  const supabase = getBrowserSupabase();
  const { data: u } = await supabase.auth.getUser();
  const userId = u?.user?.id ? String(u.user.id) : "";
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };

  const nick = String(nickname || "").trim().slice(0, 10);
  if (!nick) return { ok: false, error: "닉네임을 입력해 주세요." };

  const { error } = await supabase
    .from("panana_user_profiles")
    .upsert({ user_id: userId, nickname: nick }, { onConflict: "user_id" });

  if (error) return { ok: false, error: error.message || "저장에 실패했어요." };
  return { ok: true };
}

