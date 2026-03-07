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

/** 마이페이지용: 현재 유저의 파나나 잔액. 1:1 명세 시 amount_base + amount_bonus, 없으면 panana_balance */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pananaId = url.searchParams.get("pananaId") || undefined;
    const session = await getServerSession(authOptions);
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId, session });
    const { data } = await sb
      .from("panana_billing_profiles")
      .select("panana_balance, amount_base, amount_bonus")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ ok: true, pananaBalance: 0 });
    }

    const row = data as { panana_balance?: number; amount_base?: number; amount_bonus?: number };
    const hasSplit =
      typeof row.amount_base === "number" && typeof row.amount_bonus === "number";
    const balance = hasSplit
      ? Math.max(0, Number(row.amount_base) + Number(row.amount_bonus))
      : (typeof row.panana_balance === "number" ? Number(row.panana_balance) : 0);
    return NextResponse.json({
      ok: true,
      pananaBalance: Math.max(0, balance),
      ...(hasSplit && {
        amountBase: Math.max(0, Number(row.amount_base)),
        amountBonus: Math.max(0, Number(row.amount_bonus)),
      }),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
