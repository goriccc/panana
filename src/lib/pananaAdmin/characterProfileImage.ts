import { getBrowserSupabase } from "@/lib/supabase/browser";

const BUCKET = "panana-characters";

export function storagePathFromPublicUrl(url: string) {
  // .../storage/v1/object/public/panana-characters/<path>
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export function publicUrlFromPath(path: string) {
  if (!path) return "";
  const supabase = getBrowserSupabase();
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** PNG/JPG 업로드 시 WebP로 변환해 Supabase에 저장 */
export async function uploadCharacterProfileImage(characterId: string, file: File) {
  const supabase = getBrowserSupabase();
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  if (!token) throw new Error("로그인이 필요해요.");

  const form = new FormData();
  form.append("file", file);
  form.append("characterId", characterId);

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}/api/admin/character-profile-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `업로드 실패 (${res.status})`);
  }
  return { path: json.path, publicUrl: json.publicUrl, title: file.name };
}

export async function deleteCharacterProfileImageByUrl(url: string) {
  const supabase = getBrowserSupabase();
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}

