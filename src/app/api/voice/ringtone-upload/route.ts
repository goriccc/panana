import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const BUCKET = "panana-characters";
const RINGTONE_PATH = "voice/ringtone.mp3";
const HANGUP_SOUND_PATH = "voice/hangup.mp3";

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

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAuthed(req);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || "";
    if (userErr || !userId) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }

    const { data: allow } = await supabase
      .from("panana_admin_users")
      .select("active")
      .eq("user_id", userId)
      .maybeSingle();
    if (!allow?.active) {
      return NextResponse.json({ ok: false, error: "권한이 없어요." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const kindRaw = String(searchParams.get("type") || "ringtone").trim().toLowerCase();
    const uploadPath = kindRaw === "hangup" ? HANGUP_SOUND_PATH : RINGTONE_PATH;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "파일이 필요해요." }, { status: 400 });
    }
    if (!file.type.startsWith("audio/") && file.type !== "audio/mpeg") {
      return NextResponse.json({ ok: false, error: "MP3 등 오디오 파일만 업로드할 수 있어요." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "5MB 이하로 업로드해 주세요." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { error } = await sb.storage.from(BUCKET).upload(uploadPath, buf, {
      contentType: file.type || "audio/mpeg",
      cacheControl: "3600",
      upsert: true,
    });
    if (error) throw error;

    const { data } = sb.storage.from(BUCKET).getPublicUrl(uploadPath);
    const publicUrl = data?.publicUrl ? String(data.publicUrl) : "";
    if (!publicUrl) throw new Error("publicUrl 생성 실패");

    return NextResponse.json({ ok: true, publicUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "업로드에 실패했어요.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
