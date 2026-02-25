import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

/** 유저(마이)의 팔로워 수·팔로잉 수. 팔로워=나를 팔로우하는 캐릭터 수, 팔로잉=내가 팔로우한 캐릭터 수. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pananaId = String(url.searchParams.get("pananaId") || "").trim();
    if (!pananaId || !isUuid(pananaId)) {
      return NextResponse.json({ ok: false, error: "pananaId 필요해요." }, { status: 400 });
    }

    const sb = getSb();

    const [followersRes, followingRes] = await Promise.all([
      sb.from("panana_character_follows_user").select("panana_id", { count: "exact", head: true }).eq("panana_id", pananaId),
      sb.from("panana_user_follows_character").select("panana_id", { count: "exact", head: true }).eq("panana_id", pananaId),
    ]);

    const followersTotal = typeof (followersRes as { count?: number }).count === "number" ? (followersRes as { count: number }).count : 0;
    const followingTotal = typeof (followingRes as { count?: number }).count === "number" ? (followingRes as { count: number }).count : 0;

    return NextResponse.json({
      ok: true,
      followersTotal,
      followingTotal,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
