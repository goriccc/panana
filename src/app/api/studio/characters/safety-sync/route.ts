import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const BodySchema = z.object({
  studioCharacterId: z.string().min(1),
  nsfwFilterOff: z.boolean(),
});

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

function getSupabaseAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const supabase = getSupabaseAuthed(req);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || "";
    if (userErr || !userId) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }

    // Admin allowlist 체크(Studio/어드민 내부용)
    const { data: allow, error: allowErr } = await supabase
      .from("panana_admin_users")
      .select("active")
      .eq("user_id", userId)
      .maybeSingle();
    if (allowErr) throw allowErr;
    if (!allow?.active) {
      return NextResponse.json({ ok: false, error: "권한이 없어요." }, { status: 403 });
    }

    const sbAdmin = getSupabaseAdmin();
    const { data: updatedRows, error: upErr } = await sbAdmin
      .from("panana_characters")
      .update({ safety_supported: body.nsfwFilterOff })
      .eq("studio_character_id", body.studioCharacterId)
      .select("id");
    if (upErr) throw upErr;

    return NextResponse.json({ ok: true, updated: Array.isArray(updatedRows) ? updatedRows.length : 0 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "스파이시 동기화에 실패했어요." }, { status: 500 });
  }
}

