import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSb() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    if (!isUuid(challengeId)) return NextResponse.json({ ok: false, error: "Invalid challenge id" }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as { pananaId?: string };
    const session = await getServerSession(authOptions);
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: body?.pananaId || null, session });

    const { data: chal } = await sb
      .from("panana_challenges")
      .select("id")
      .eq("id", challengeId)
      .eq("active", true)
      .maybeSingle();
    if (!chal) return NextResponse.json({ ok: false, error: "Challenge not found" }, { status: 404 });

    const now = new Date().toISOString();
    const { error } = await sb.from("panana_challenge_sessions").upsert(
      { user_id: userId, challenge_id: challengeId, started_at: now },
      { onConflict: "user_id,challenge_id", ignoreDuplicates: false }
    );
    if (error) throw error;

    return NextResponse.json({ ok: true, startedAt: now });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
