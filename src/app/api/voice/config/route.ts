import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSupabaseAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function getSupabaseAnon() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(url, anonKey, { auth: { persistSession: false } });
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

export async function GET() {
  try {
    const supabase = getSupabaseAnon();
    const { data, error } = await supabase
      .from("panana_voice_config")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({
      ok: true,
      data: data ?? {
        voice_style_female: "warm",
        voice_style_male: "calm",
        voice_name_female: "Aoede",
        voice_name_male: "Fenrir",
        base_model: "gemini-2.5-flash-native-audio-preview-12-2025",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sb = getSupabaseAdmin();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (
      typeof body.voice_style_female === "string" &&
      ["calm", "bright", "firm", "empathetic", "warm"].includes(body.voice_style_female)
    ) {
      updateData.voice_style_female = body.voice_style_female;
    }
    if (
      typeof body.voice_style_male === "string" &&
      ["calm", "bright", "firm", "empathetic", "warm"].includes(body.voice_style_male)
    ) {
      updateData.voice_style_male = body.voice_style_male;
    }
    if (typeof body.voice_name_female === "string") updateData.voice_name_female = body.voice_name_female;
    if (typeof body.voice_name_male === "string") updateData.voice_name_male = body.voice_name_male;
    if (typeof body.base_model === "string") updateData.base_model = body.base_model;

    const { data: existing } = await sb
      .from("panana_voice_config")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await sb
        .from("panana_voice_config")
        .update(updateData)
        .eq("id", existing.id)
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, data });
    }

    const { data, error } = await sb
      .from("panana_voice_config")
      .insert({
        voice_gender: "female",
        voice_style: "warm",
        voice_style_female: updateData.voice_style_female ?? "warm",
        voice_style_male: updateData.voice_style_male ?? "calm",
        voice_name_female: updateData.voice_name_female ?? "Aoede",
        voice_name_male: updateData.voice_name_male ?? "Fenrir",
        base_model: updateData.base_model ?? "gemini-2.5-flash-native-audio-preview-12-2025",
        updated_at: updateData.updated_at,
      })
      .select("*")
      .limit(1)
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
