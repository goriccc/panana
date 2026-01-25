import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  slugs: z.array(z.string().min(1)).max(100), // 최대 100개까지 한 번에 조회
});

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env");
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("panana_public_characters_v")
      .select("slug, safety_supported")
      .in("slug", body.slugs);

    if (error) {
      const msg = String((error as any)?.message || "");
      // 하위호환: 컬럼/뷰가 아직 없을 수 있음
      if (msg.includes("safety_supported")) {
        return NextResponse.json({ ok: true, results: {} });
      }
      throw error;
    }

    const results: Record<string, boolean> = {};
    (data || []).forEach((r: any) => {
      results[String(r.slug || "")] = Boolean(r.safety_supported);
    });

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to fetch safety info" }, { status: 500 });
  }
}
