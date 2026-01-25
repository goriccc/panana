import { getBrowserSupabase } from "@/lib/supabase/browser";

export type AirportSection = "immigration" | "immigration_chat" | "complete";

export type AirportThumbnailSetRow = {
  id: string;
  section: AirportSection;
  title: string;
  image_path: string;
  video_path: string; // '' if none
  sort_order: number;
  active: boolean;
};

const BUCKET = "panana-airport";

export function publicUrlFromPath(path: string) {
  if (!path) return "";
  const supabase = getBrowserSupabase();
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function listThumbnailSets(section: AirportSection) {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("panana_airport_thumbnail_sets")
    .select("id, section, title, image_path, video_path, sort_order, active")
    .eq("section", section)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as AirportThumbnailSetRow[];
}

export async function createThumbnailSet(section: AirportSection) {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("panana_airport_thumbnail_sets")
    .insert({ section, title: "새 썸네일 세트", image_path: "", video_path: "", active: true })
    .select("id, section, title, image_path, video_path, sort_order, active")
    .single();
  if (error) throw error;
  return data as AirportThumbnailSetRow;
}

export async function updateThumbnailSet(id: string, patch: Partial<AirportThumbnailSetRow>) {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("panana_airport_thumbnail_sets")
    .update(patch)
    .eq("id", id)
    .select("id, section, title, image_path, video_path, sort_order, active")
    .single();
  if (error) throw error;
  return data as AirportThumbnailSetRow;
}

export async function deleteThumbnailSet(id: string) {
  const supabase = getBrowserSupabase();

  const { data: row, error: selErr } = await supabase
    .from("panana_airport_thumbnail_sets")
    .select("section, image_path, video_path")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;

  const imagePath = (row as any)?.image_path as string | undefined;
  const videoPath = (row as any)?.video_path as string | undefined;

  const removePaths = [imagePath, videoPath].filter((p): p is string => Boolean(p));
  if (removePaths.length) {
    await supabase.storage.from(BUCKET).remove(removePaths).catch(() => {});
  }

  const { error } = await supabase.from("panana_airport_thumbnail_sets").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadSetImage(section: AirportSection, setId: string, file: File) {
  const supabase = getBrowserSupabase();
  // 고정 키: 확장자 없이 업서트 (content-type으로 구분)
  const path = `${section}/${setId}/image`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function uploadSetVideo(section: AirportSection, setId: string, file: File) {
  const supabase = getBrowserSupabase();
  // 고정 키: 확장자 없이 업서트 (content-type으로 구분)
  const path = `${section}/${setId}/video`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

