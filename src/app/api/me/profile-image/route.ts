import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";

export const runtime = "nodejs";

const BUCKET = "panana-characters";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "파일이 필요합니다." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "이미지 파일만 업로드할 수 있어요." }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "이미지는 8MB 이하로 업로드해 주세요." }, { status: 400 });
    }

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const provider = String((session as any)?.provider || "unknown");
    const pid = String((session as any)?.providerAccountId || "me");
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const safeExt = ext || "png";
    const path = `user-avatars/${provider}/${pid}.${safeExt}`;

    const buf = new Uint8Array(await file.arrayBuffer());
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
      upsert: true,
      contentType: file.type,
      cacheControl: "86400",
    });
    if (error) throw error;

    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = data?.publicUrl ? String(data.publicUrl) : "";
    if (!publicUrl) throw new Error("publicUrl 생성 실패");

    return NextResponse.json({ ok: true, publicUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "업로드에 실패했어요." }, { status: 400 });
  }
}

