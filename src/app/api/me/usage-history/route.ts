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

/** 차감(소진) 내역: 일자, 소진 파나나, 내용(채팅 1턴 등) 리스트 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: null, session });

    const { data: rows, error } = await sb
      .from("panana_billing_transactions")
      .select("id, created_at, amount, total_amount, description")
      .eq("user_id", userId)
      .eq("type", "usage")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const list = (rows ?? []).map((r: any) => {
      const raw = Number(r.amount ?? r.total_amount ?? 0);
      const pDeducted = raw < 0 ? -raw : raw;
      return {
        id: r.id,
        date: r.created_at,
        pDeducted,
        description: r.description ?? "파나나 사용",
      };
    });

    return NextResponse.json({ ok: true, list });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
