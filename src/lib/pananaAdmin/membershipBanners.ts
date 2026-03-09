import { getBrowserSupabase } from "@/lib/supabase/browser";

export type MembershipBannerRow = {
  id: string;
  title: string;
  image_path: string;
  image_url: string;
  link_url: string;
  sort_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

const BUCKET = "panana-membership";

export function publicUrlFromPath(path: string) {
  if (!path) return "";
  const supabase = getBrowserSupabase();
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function listMembershipBanners() {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("panana_membership_banners")
    .select("id, title, image_path, image_url, link_url, sort_order, active, starts_at, ends_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as MembershipBannerRow[];
}

export async function createMembershipBanner() {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("panana_membership_banners")
    .insert({
      title: "새 배너",
      image_path: "",
      image_url: "",
      link_url: "/my/membership",
      sort_order: 0,
      active: true,
      starts_at: null,
      ends_at: null,
    })
    .select("id, title, image_path, image_url, link_url, sort_order, active, starts_at, ends_at")
    .single();
  if (error) throw error;
  return data as MembershipBannerRow;
}

export async function updateMembershipBanner(id: string, patch: Partial<MembershipBannerRow>) {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("panana_membership_banners")
    .update(patch)
    .eq("id", id)
    .select("id, title, image_path, image_url, link_url, sort_order, active, starts_at, ends_at")
    .single();
  if (error) throw error;
  return data as MembershipBannerRow;
}

export async function deleteMembershipBanner(id: string) {
  const supabase = getBrowserSupabase();
  const { data: row, error: selErr } = await supabase
    .from("panana_membership_banners")
    .select("image_path")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;

  const imagePath = (row as any)?.image_path as string | undefined;
  if (imagePath) {
    await supabase.storage.from(BUCKET).remove([imagePath]).catch(() => {});
  }

  const { error } = await supabase.from("panana_membership_banners").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadMembershipBannerImage(bannerId: string, file: File) {
  const supabase = getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("로그인이 필요해요.");
  const form = new FormData();
  form.append("file", file);
  form.append("bannerId", bannerId);
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}/api/admin/membership-banner-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  const json = (await res.json()) as { ok?: boolean; path?: string; imageUrl?: string; error?: string };
  if (!res.ok || !json.ok) throw new Error(json?.error || "업로드에 실패했어요.");
  return { path: json.path ?? "", imageUrl: json.imageUrl ?? "" };
}

export async function reorderMembershipBanners(idsInOrder: string[]) {
  const supabase = getBrowserSupabase();
  const patches = idsInOrder.map((id, idx) => ({ id, sort_order: idx }));
  const { error } = await supabase.from("panana_membership_banners").upsert(patches, { onConflict: "id" });
  if (error) throw error;
  return { ok: true as const };
}

