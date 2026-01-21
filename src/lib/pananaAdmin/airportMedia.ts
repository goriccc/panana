import { getBrowserSupabase } from "@/lib/supabase/browser";

export type AirportSection = "immigration" | "complete";
export type AirportMediaKind = "image" | "video";

export type AirportMediaRow = {
  id: string;
  section: AirportSection;
  kind: AirportMediaKind;
  title: string;
  media_url: string;
  sort_order: number;
  active: boolean;
};

const BUCKET = "panana-airport";

function uuid() {
  // 브라우저 지원 우선
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function storagePathFromPublicUrl(url: string) {
  // .../storage/v1/object/public/panana-airport/<path>
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export async function listAirportMedia(section: AirportSection) {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("panana_airport_media")
    .select("id, section, kind, title, media_url, sort_order, active")
    .eq("section", section)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as AirportMediaRow[];
}

export async function createAirportMedia(section: AirportSection) {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("panana_airport_media")
    .insert({ section, kind: "image", title: "새 썸네일", media_url: "", active: true })
    .select("id, section, kind, title, media_url, sort_order, active")
    .single();
  if (error) throw error;
  return data as AirportMediaRow;
}

export async function updateAirportMedia(id: string, patch: Partial<AirportMediaRow>) {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("panana_airport_media")
    .update(patch)
    .eq("id", id)
    .select("id, section, kind, title, media_url, sort_order, active")
    .single();
  if (error) throw error;
  return data as AirportMediaRow;
}

export async function deleteAirportMedia(id: string) {
  const supabase = getBrowserSupabase();
  // 먼저 URL을 얻어 storage도 삭제(가능한 경우)
  const { data: row, error: selErr } = await supabase
    .from("panana_airport_media")
    .select("media_url")
    .eq("id", id)
    .maybeSingle();
  if (selErr) throw selErr;

  const url = (row as any)?.media_url as string | undefined;
  if (url) {
    const path = storagePathFromPublicUrl(url);
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    }
  }

  const { error } = await supabase.from("panana_airport_media").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadAirportFile(section: AirportSection, file: File) {
  const supabase = getBrowserSupabase();
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const id = uuid();
  const path = `${section}/${id}${ext ? `.${ext}` : ""}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const kind: AirportMediaKind = file.type.startsWith("video/") ? "video" : "image";
  return { publicUrl, kind, title: file.name };
}

