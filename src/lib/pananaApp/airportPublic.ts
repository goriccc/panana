import { getBrowserSupabase } from "@/lib/supabase/browser";

export type AirportSection = "immigration" | "immigration_chat" | "complete";

export type AirportThumbnailSet = {
  id: string;
  section: AirportSection;
  title: string;
  image_path: string;
  video_path: string;
  sort_order: number;
};

export type AirportPublicMediaRow = {
  id: string;
  section: AirportSection;
  kind: "image" | "video";
  title: string;
  media_url: string;
  sort_order: number;
};

export type AirportPublicCopyRow = {
  id: string;
  key: string;
  text: string;
  sort_order: number;
};

const BUCKET = "panana-airport";

export function publicUrlFromStoragePath(path: string) {
  if (!path) return "";
  const supabase = getBrowserSupabase();
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function trySelect<T>(tableOrView: string, query: (q: any) => any) {
  const supabase = getBrowserSupabase();
  const { data, error } = await query(supabase.from(tableOrView));
  if (error) throw error;
  return (data || []) as T[];
}

export async function fetchAirportThumbnailSets(section: AirportSection) {
  // 1) (권장) 공개용 view가 있으면 사용
  // NOTE: 아직 PUBLIC_VIEWS.sql에 새 view를 추가하지 않았을 수 있으니 폴백을 둠.
  try {
    const rows = await trySelect<AirportThumbnailSet>("panana_public_airport_thumbnail_sets_v", (q) =>
      q
        .select("id, section, title, image_path, video_path, sort_order")
        .eq("section", section)
        .order("sort_order", { ascending: true })
    );
    // "세트는 있지만 미디어가 비어있음"이면(빈 세트만 존재) 구버전 뷰로 폴백해야 실제 썸네일이 보임
    // 또한 새 뷰가 비어있고(0개) 구버전 데이터만 존재할 수도 있어 폴백
    if (!rows.length) {
      throw new Error("empty_sets");
    }
    if (rows.length && !rows.some((r) => r.image_path || r.video_path)) {
      throw new Error("empty_media_sets");
    }
    return rows;
  } catch {
    // ignore and fallback
  }

  // 2) 테이블 직접 조회(프로젝트가 public read 허용인 경우)
  try {
    const rows = await trySelect<AirportThumbnailSet>("panana_airport_thumbnail_sets", (q) =>
      q
        .select("id, section, title, image_path, video_path, sort_order")
        .eq("section", section)
        .eq("active", true)
        .order("sort_order", { ascending: true })
    );
    if (!rows.length) {
      throw new Error("empty_sets");
    }
    if (rows.length && !rows.some((r) => r.image_path || r.video_path)) {
      throw new Error("empty_media_sets");
    }
    return rows;
  } catch {
    // ignore and fallback
  }

  // 3) 구버전 public view(단일 미디어)로 폴백
  try {
    const rows = await trySelect<AirportPublicMediaRow>("panana_public_airport_media_v", (q) =>
      q
        .select("id, section, kind, title, media_url, sort_order")
        .eq("section", section)
        .order("sort_order", { ascending: true })
    );

    // kind=image/video를 "세트" 형태로 변환(이미지/동영상 각각 1개만)
    const image = rows.find((r) => r.kind === "image")?.media_url || "";
    const video = rows.find((r) => r.kind === "video")?.media_url || "";
    if (!image && !video) return [];

    return [
      {
        id: `legacy-${section}`,
        section,
        title: "",
        image_path: image, // 여기서는 URL이 들어오지만 UI에서 둘 다 처리 가능하게 함
        video_path: video,
        sort_order: 0,
      },
    ] as AirportThumbnailSet[];
  } catch {
    return [];
  }
}

export async function fetchAirportCopy(key: string) {
  // 공개 view 우선
  try {
    const rows = await trySelect<AirportPublicCopyRow>("panana_public_airport_copy_v", (q) =>
      q.select("id, key, text, sort_order").eq("key", key).order("sort_order", { ascending: true })
    );
    return rows;
  } catch {
    // ignore and fallback
  }

  // 테이블 직접(프로젝트가 public read 허용일 때)
  try {
    const rows = await trySelect<AirportPublicCopyRow>("panana_airport_copy", (q) =>
      q.select("id, key, text, sort_order").eq("key", key).eq("active", true).order("sort_order", { ascending: true })
    );
    return rows;
  } catch {
    return [];
  }
}

