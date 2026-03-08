import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { resolveUserId } from "@/lib/challenge/resolveUserId";
import { getBalanceForUserId } from "@/lib/pananaApp/balanceServer";

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

/** 마이페이지용: 현재 유저의 파나나 잔액. 1:1 명세 시 amount_base + amount_bonus, 없으면 panana_balance */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pananaId = url.searchParams.get("pananaId") || undefined;
    const session = await getServerSession(authOptions);
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId, session });
    const pananaBalance = await getBalanceForUserId(sb, userId);
    return NextResponse.json({ ok: true, pananaBalance });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
