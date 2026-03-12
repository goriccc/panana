import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase/client";
import sharp from "sharp";

export const runtime = "nodejs";

const BUCKET = "panana-membership";
/** 배너 표시용 최대 너비 (2x 기준 420*2≈840, 여유 있게 960) */
const MAX_WIDTH = 960;
const WEBP_QUALITY = 82;

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

/** 멤버십 배너 이미지를 Storage에서 받아 프록시 (액박 방지: 동일 도메인에서 로드) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    let path: string | null = null;
    const viewRes = await supabase
      .from("panana_public_membership_banners_v")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();
    if (!viewRes.error && viewRes.data) {
      path = String((viewRes.data as { image_path?: string })?.image_path || "").trim() || null;
    }
    if (!path) {
      const tableRes = await supabase
        .from("panana_membership_banners")
        .select("image_path")
        .eq("id", id)
        .eq("active", true)
        .maybeSingle();
      if (tableRes.error || !tableRes.data?.image_path) {
        return NextResponse.json({ error: "Banner not found" }, { status: 404 });
      }
      path = String(tableRes.data.image_path || "").trim() || null;
    }
    if (!path) return NextResponse.json({ error: "No image" }, { status: 404 });

    const { data: fileData, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const input = Buffer.from(await fileData.arrayBuffer());
    const resized = await sharp(input)
      .resize(MAX_WIDTH, null, { withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    return new NextResponse(new Uint8Array(resized), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    console.warn("[membership-banner-image]", (e as Error)?.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
