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

  const [llmRes, siteRes] = await Promise.all([
    supabase
      .from("panana_llm_settings")
      .select("scope, provider, model, temperature, max_tokens, top_p, force_parenthesis, nsfw_filter")
      .eq("scope", scope)
      .order("provider", { ascending: true }),
    supabase.from("panana_public_site_settings_v").select("llm_default_provider, llm_fallback_provider, llm_fallback_model").limit(1).maybeSingle(),
  ]);

  if (llmRes.error) return NextResponse.json({ ok: false, error: llmRes.error.message }, { status: 500 });

  const site = siteRes.data;
  const defaultProvider = (site as any)?.llm_default_provider || "anthropic";
  const fallbackProvider = (site as any)?.llm_fallback_provider || "gemini";
  const fallbackModel = (site as any)?.llm_fallback_model || "gemini-2.5-flash";

  return NextResponse.json({
    ok: true,
    scope,
    defaultProvider,
    fallbackProvider,
    fallbackModel,
    settings: (llmRes.data || []).map((s: any) => ({
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

