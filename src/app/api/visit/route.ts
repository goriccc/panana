import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * 유입 로그 기록 (panana_visits)
 * - GET /api/visit?visitor_id=xxx (visitor_id 선택)
 * - 서비스 역할로 insert만 수행, 인증 불필요
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const visitorId = url.searchParams.get("visitor_id")?.trim() || null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: "Server config missing" }, { status: 500 });
    }

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { error } = await sb.from("panana_visits").insert({
      visitor_id: visitorId || null,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
