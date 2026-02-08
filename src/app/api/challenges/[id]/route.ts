import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ ok: false, error: "Invalid challenge id" }, { status: 400 });

    const sb = getSb();
    const { data, error } = await sb
      .from("panana_challenges")
      .select(
        `
        id,
        character_id,
        title,
        challenge_goal,
        challenge_situation,
        success_keywords,
        partial_match,
        gender,
        sort_order,
        panana_characters!inner(slug, name, profile_image_url)
      `
      )
      .eq("id", id)
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: "Challenge not found" }, { status: 404 });

    const ch = (data as any).panana_characters;
    const char = Array.isArray(ch) ? ch[0] : ch;

    const item = {
      id: data.id,
      characterId: data.character_id,
      characterSlug: char?.slug || null,
      characterName: char?.name || null,
      profileImageUrl: char?.profile_image_url || null,
      title: data.title || "",
      challengeGoal: data.challenge_goal || "",
      challengeSituation: data.challenge_situation || "",
      successKeywords: Array.isArray((data as any).success_keywords) ? (data as any).success_keywords : [],
      partialMatch: Boolean((data as any).partial_match),
      gender: (data as any).gender || null,
      sortOrder: Number((data as any).sort_order) || 0,
    };

    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
