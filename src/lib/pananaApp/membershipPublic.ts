import { getSupabaseClient } from "@/lib/supabase/client";

export type PublicMembershipBanner = {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  sort_order: number;
};

export async function fetchPublicMembershipBanners(): Promise<PublicMembershipBanner[]> {
  const supabase = getSupabaseClient();

  // 1) 권장: 공개 뷰(권한/보안 어드바이저 대응)
  const viewRes = await supabase
    .from("panana_public_membership_banners_v")
    .select("id, title, image_url, link_url, sort_order")
    .order("sort_order", { ascending: true });

  if (!viewRes.error) {
    return (viewRes.data || []) as PublicMembershipBanner[];
  }

  // 뷰 조회가 권한 에러(42501)면 테이블 폴백도 동일하게 막히는 경우가 많고 로그만 지저분해집니다.
  // 이 경우에는 조용히 빈 배열을 반환(배너 미노출)하고, 권한/뷰 설정으로 해결하도록 유도합니다.
  if (viewRes.error?.code === "42501") {
    console.error("[membership] view fetch permission denied:", viewRes.error);
    return [];
  }

  // 2) 폴백: 뷰가 아직 없거나(PGRST205/42P01) 배포/마이그레이션 타이밍 이슈일 때만 사용
  console.error("[membership] view fetch failed, fallback to table:", viewRes.error);

  const tableRes = await supabase
    .from("panana_membership_banners")
    .select("id, title, image_url, link_url, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (tableRes.error) {
    console.error("[membership] table fetch failed:", tableRes.error);
    return [];
  }

  return (tableRes.data || []) as PublicMembershipBanner[];
}

