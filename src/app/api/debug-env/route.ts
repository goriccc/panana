import { NextResponse } from "next/server";

export const runtime = "nodejs";

function prefix(s: string | undefined, n: number) {
  if (!s) return "";
  return s.slice(0, n);
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // 절대 전체 키를 반환하지 않는다 (prefix + length만)
  return NextResponse.json({
    ok: Boolean(url && anon),
    supabaseUrlHost: url ? new URL(url).host : "",
    anonKeyPrefix: prefix(anon, 16),
    anonKeyLength: anon.length,
    nodeEnv: process.env.NODE_ENV,
  });
}

