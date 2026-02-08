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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gender = String(url.searchParams.get("gender") || "").trim().toLowerCase();
    const validGender = ["female", "male", "both"].includes(gender) ? gender : null;

    const sb = getSb();
    let q = sb
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
        panana_characters!inner(slug, name, profile_image_url, hashtags, safety_supported)
      `
      )
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (validGender && validGender !== "both") {
      q = q.or(`gender.is.null,gender.eq.${validGender},gender.eq.both`);
    }

    const { data, error } = await q;
    if (error) throw error;

    const items = (data || []).map((r: any) => {
      const ch = r.panana_characters;
      const char = Array.isArray(ch) ? ch[0] : ch;
      const hashtags = Array.isArray(char?.hashtags) ? char.hashtags : [];
      return {
        id: r.id,
        characterId: r.character_id,
        characterSlug: char?.slug || null,
        characterName: char?.name || null,
        profileImageUrl: char?.profile_image_url || null,
        hashtags: hashtags.filter((h: string) => String(h || "").trim()),
        title: r.title || "",
        challengeGoal: r.challenge_goal || "",
        challengeSituation: r.challenge_situation || "",
        successKeywords: Array.isArray(r.success_keywords) ? r.success_keywords : [],
        partialMatch: Boolean(r.partial_match),
        gender: r.gender || null,
        sortOrder: Number(r.sort_order) || 0,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
