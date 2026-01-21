import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env");
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

type SetRow = {
  id: string;
  section: string;
  title: string;
  image_path: string;
  video_path: string;
  sort_order: number;
};

type LegacyRow = {
  id: string;
  section: string;
  kind: string;
  title: string;
  media_url: string;
  sort_order: number;
};

export async function GET() {
  const supabase = getServerSupabase();

  const [setsImm, setsComp, legacyImm, legacyComp] = await Promise.all([
    supabase
      .from("panana_public_airport_thumbnail_sets_v")
      .select("id, section, title, image_path, video_path, sort_order")
      .eq("section", "immigration")
      .order("sort_order", { ascending: true })
      .limit(5),
    supabase
      .from("panana_public_airport_thumbnail_sets_v")
      .select("id, section, title, image_path, video_path, sort_order")
      .eq("section", "complete")
      .order("sort_order", { ascending: true })
      .limit(5),
    supabase
      .from("panana_public_airport_media_v")
      .select("id, section, kind, title, media_url, sort_order")
      .eq("section", "immigration")
      .order("sort_order", { ascending: true })
      .limit(5),
    supabase
      .from("panana_public_airport_media_v")
      .select("id, section, kind, title, media_url, sort_order")
      .eq("section", "complete")
      .order("sort_order", { ascending: true })
      .limit(5),
  ]);

  const json = {
    ok: true,
    sets: {
      immigration: {
        error: setsImm.error?.message || null,
        count: (setsImm.data as any[])?.length || 0,
        sample: ((setsImm.data || []) as SetRow[]).map((r) => ({
          id: r.id,
          section: r.section,
          title: r.title,
          image_path: r.image_path,
          video_path: r.video_path,
          sort_order: r.sort_order,
        })),
      },
      complete: {
        error: setsComp.error?.message || null,
        count: (setsComp.data as any[])?.length || 0,
        sample: ((setsComp.data || []) as SetRow[]).map((r) => ({
          id: r.id,
          section: r.section,
          title: r.title,
          image_path: r.image_path,
          video_path: r.video_path,
          sort_order: r.sort_order,
        })),
      },
    },
    legacy: {
      immigration: {
        error: legacyImm.error?.message || null,
        count: (legacyImm.data as any[])?.length || 0,
        sample: ((legacyImm.data || []) as LegacyRow[]).map((r) => ({
          id: r.id,
          section: r.section,
          kind: r.kind,
          title: r.title,
          media_url: r.media_url,
          sort_order: r.sort_order,
        })),
      },
      complete: {
        error: legacyComp.error?.message || null,
        count: (legacyComp.data as any[])?.length || 0,
        sample: ((legacyComp.data || []) as LegacyRow[]).map((r) => ({
          id: r.id,
          section: r.section,
          kind: r.kind,
          title: r.title,
          media_url: r.media_url,
          sort_order: r.sort_order,
        })),
      },
    },
  };

  return NextResponse.json(json);
}

