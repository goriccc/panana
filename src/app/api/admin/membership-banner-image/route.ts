import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";

const BUCKET = "panana-membership";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSupabaseAuthed(req: Request) {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing Authorization token");
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

/** 멤버십 배너 이미지 업로드: PNG/JPG 등 → WebP 변환 후 Storage + DB 업데이트 */
export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAuthed(req);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || "";
    if (userErr || !userId) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }

    const { data: allow, error: allowErr } = await supabase
      .from("panana_admin_users")
      .select("active")
      .eq("user_id", userId)
      .maybeSingle();
    if (allowErr) throw allowErr;
    if (!allow?.active) {
      return NextResponse.json({ ok: false, error: "권한이 없어요." }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const bannerId = form.get("bannerId");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "파일이 필요해요." }, { status: 400 });
    }
    if (!bannerId || typeof bannerId !== "string" || !isUuid(bannerId.trim())) {
      return NextResponse.json({ ok: false, error: "bannerId가 필요해요." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "이미지 파일만 업로드할 수 있어요." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "이미지는 8MB 이하로 업로드해 주세요." },
        { status: 400 }
      );
    }

    const inputBuf = Buffer.from(await file.arrayBuffer());
    const webpBuf = await sharp(inputBuf)
      .webp({ quality: 88, effort: 4 })
      .toBuffer();

    const path = `banners/${bannerId.trim()}/image`;
    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { error: uploadError } = await sb.storage.from(BUCKET).upload(path, webpBuf, {
      contentType: "image/webp",
      cacheControl: "86400",
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(path);
    const imageUrl = urlData?.publicUrl ? String(urlData.publicUrl) : "";
    if (!imageUrl) throw new Error("publicUrl 생성 실패");

    const { error: updateError } = await sb
      .from("panana_membership_banners")
      .update({ image_path: path, image_url: imageUrl })
      .eq("id", bannerId.trim());
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, path, imageUrl });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "업로드에 실패했어요." },
      { status: 400 }
    );
  }
}
