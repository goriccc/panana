import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env");
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "global";
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from("panana_llm_settings")
    .select("scope, provider, model, temperature, max_tokens, top_p, force_parenthesis, nsfw_filter")
    .eq("scope", scope)
    .order("provider", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    scope,
    // 알파 테스트는 프론트에서 provider를 직접 선택하므로, defaultProvider는 고정값만 제공
    defaultProvider: "anthropic",
    settings: (data || []).map((s: any) => ({
      provider: s.provider,
      model: s.model,
      temperature: s.temperature,
      topP: s.top_p,
      maxTokens: s.max_tokens,
      forceParenthesis: s.force_parenthesis,
      nsfwFilter: s.nsfw_filter,
    })),
  });
}

