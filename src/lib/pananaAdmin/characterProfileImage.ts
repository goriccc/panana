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

export async function uploadCharacterProfileImage(characterId: string, file: File) {
  const supabase = getBrowserSupabase();
  const path = `profiles/${characterId}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "86400",
  });
  if (error) throw error;
  return { path, publicUrl: publicUrlFromPath(path), title: file.name };
}

export async function deleteCharacterProfileImageByUrl(url: string) {
  const supabase = getBrowserSupabase();
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}

