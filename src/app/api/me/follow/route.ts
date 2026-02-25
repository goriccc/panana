import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

function getSb() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

async function ensurePananaUser(sb: SupabaseClient<any>, pananaId: string) {
  const { data: u } = await sb.from("panana_users").select("id").eq("id", pananaId).maybeSingle<{ id: string }>();
  if (u?.id) return;
  throw new Error("유저 정보를 찾을 수 없어요.");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const pananaId = String(body?.pananaId || "").trim();
    const characterSlug = String(body?.characterSlug || "").trim().toLowerCase();
    const action = body?.action === "unfollow" ? "unfollow" : "follow";
    if (!isUuid(pananaId)) return NextResponse.json({ ok: false, error: "Invalid pananaId" }, { status: 400 });
    if (!characterSlug) return NextResponse.json({ ok: false, error: "Missing characterSlug" }, { status: 400 });

    const sb = getSb();
    await ensurePananaUser(sb, pananaId);

    if (action === "follow") {
      const { error } = await sb.from("panana_user_follows_character").upsert(
        { panana_id: pananaId, character_slug: characterSlug },
        { onConflict: "panana_id,character_slug" }
      );
      if (error) throw error;
      return NextResponse.json({ ok: true, isFollowing: true });
    }

    const { error } = await sb
      .from("panana_user_follows_character")
      .delete()
      .eq("panana_id", pananaId)
      .eq("character_slug", characterSlug);
    if (error) throw error;
    return NextResponse.json({ ok: true, isFollowing: false });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
