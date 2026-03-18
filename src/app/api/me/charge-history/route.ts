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
  return createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

/** 충전내역: 일자, 충전 파나나, 충전금액(KRW) 리스트 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: null, session });

    const { data: rows, error } = await sb
      .from("panana_billing_transactions")
      .select("id, created_at, total_amount, amount, amount_krw, description")
      .eq("user_id", userId)
      .eq("type", "recharge")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const list = (rows ?? []).map((r: any) => ({
      id: r.id,
      date: r.created_at,
      pAmount: Number(r.total_amount ?? r.amount ?? 0),
      amountKrw: r.amount_krw != null ? Number(r.amount_krw) : null,
      description: r.description ?? undefined,
    }));

    return NextResponse.json({ ok: true, list });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
