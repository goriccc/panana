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

function getHangupFallbackPublicUrl(): string | null {
  const base = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!base) return null;
  return `${base}/storage/v1/object/public/panana-characters/voice/hangup.mp3`;
}

async function resolveHangupUrlWithFallback(raw: unknown): Promise<string | null> {
  const explicit = raw != null ? String(raw).trim() : "";
  if (explicit) return explicit;
  const fallback = getHangupFallbackPublicUrl();
  if (!fallback) return null;
  try {
    const res = await fetch(fallback, { method: "HEAD", cache: "no-store" });
    return res.ok ? fallback : null;
  } catch {
    return null;
  }
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
    const fallback = {
      voice_style_female: "warm",
      voice_style_male: "calm",
      voice_name_female: "Aoede",
      voice_name_male: "Fenrir",
      base_model: "gemini-2.5-flash-native-audio-preview-12-2025",
      ringtone_url: null as string | null,
      hangup_sound_url: null as string | null,
    };
    const resolvedHangupUrl = await resolveHangupUrlWithFallback((data as any)?.hangup_sound_url);
    return NextResponse.json({
      ok: true,
      data: data
        ? {
            ...fallback,
            ...data,
            ringtone_url: (data as any).ringtone_url ?? null,
            hangup_sound_url: resolvedHangupUrl,
          }
        : { ...fallback, hangup_sound_url: resolvedHangupUrl },
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
    if (typeof body.ringtone_url === "string" || body.ringtone_url === null) updateData.ringtone_url = body.ringtone_url;
    if (typeof body.hangup_sound_url === "string" || body.hangup_sound_url === null) {
      updateData.hangup_sound_url = body.hangup_sound_url;
    }

    const { data: existing } = await sb
      .from("panana_voice_config")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const doUpdate = async (payload: Record<string, unknown>) =>
        await sb.from("panana_voice_config").update(payload).eq("id", existing.id).select("*").limit(1).single();
      let updated = await doUpdate(updateData);
      if (updated.error && /hangup_sound_url/i.test(String((updated.error as any)?.message || ""))) {
        const fallbackPayload = { ...updateData };
        delete fallbackPayload.hangup_sound_url;
        updated = await doUpdate(fallbackPayload);
      }
      if (updated.error) throw updated.error;
      return NextResponse.json({ ok: true, data: updated.data });
    }

    const makeInsertPayload = (includeHangup: boolean) => ({
      voice_gender: "female",
      voice_style: "warm",
      voice_style_female: updateData.voice_style_female ?? "warm",
      voice_style_male: updateData.voice_style_male ?? "calm",
      voice_name_female: updateData.voice_name_female ?? "Aoede",
      voice_name_male: updateData.voice_name_male ?? "Fenrir",
      base_model: updateData.base_model ?? "gemini-2.5-flash-native-audio-preview-12-2025",
      ringtone_url: updateData.ringtone_url ?? null,
      ...(includeHangup ? { hangup_sound_url: updateData.hangup_sound_url ?? null } : {}),
      updated_at: updateData.updated_at,
    });

    let inserted = await sb.from("panana_voice_config").insert(makeInsertPayload(true)).select("*").limit(1).single();
    if (inserted.error && /hangup_sound_url/i.test(String((inserted.error as any)?.message || ""))) {
      inserted = await sb.from("panana_voice_config").insert(makeInsertPayload(false)).select("*").limit(1).single();
    }
    if (inserted.error) throw inserted.error;
    return NextResponse.json({ ok: true, data: inserted.data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
