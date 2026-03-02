import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { defaultRecommendationSettings, mergeRecommendationSettings } from "@/lib/pananaApp/recommendation";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET() {
  try {
    const supabase = createClient(
      mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
      mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    );

    const { data, error } = await supabase
      .from("panana_public_site_settings_v")
      .select("menu_visibility, recommendation_settings, recommended_search_tags")
      .limit(1)
      .maybeSingle();

    const defaultVisibility = {
      my: true,
      home: true,
      challenge: true,
      ranking: true,
      search: true,
    };
    const defaultRecommendedSearchTags = ["#현실연애", "#롤플주의", "#고백도전", "#연애감정", "#환승연애"];

    if (error) {
      const msg = String((error as any)?.message || "");
      if (
        msg.includes("recommendation_settings") ||
        msg.includes("recommended_search_tags") ||
        msg.includes("permission denied")
      ) {
        const retry = await supabase
          .from("panana_public_site_settings_v")
          .select("menu_visibility, recommendation_settings")
          .limit(1)
          .maybeSingle();
        if (retry.error) {
          const retryMsg = String((retry.error as any)?.message || "");
          if (retryMsg.includes("recommendation_settings")) {
            const menuOnly = await supabase
              .from("panana_public_site_settings_v")
              .select("menu_visibility")
              .limit(1)
              .maybeSingle();
            if (menuOnly.error) {
              console.error("Error fetching site settings:", menuOnly.error);
              return NextResponse.json({ error: menuOnly.error.message }, { status: 500 });
            }
            const fallbackMenu = menuOnly.data?.menu_visibility
              ? { ...defaultVisibility, ...(menuOnly.data.menu_visibility as any) }
              : defaultVisibility;
            return NextResponse.json({
              menuVisibility: fallbackMenu,
              recommendationSettings: defaultRecommendationSettings,
              recommendedSearchTags: defaultRecommendedSearchTags,
            });
          }
          console.error("Error fetching site settings:", retry.error);
          return NextResponse.json({ error: retry.error.message }, { status: 500 });
        }
        const fallbackMenu = retry.data?.menu_visibility
          ? { ...defaultVisibility, ...(retry.data.menu_visibility as any) }
          : defaultVisibility;
        const recSettings = retry.data?.recommendation_settings
          ? mergeRecommendationSettings(retry.data.recommendation_settings as any)
          : defaultRecommendationSettings;
        return NextResponse.json({
          menuVisibility: fallbackMenu,
          recommendationSettings: recSettings,
          recommendedSearchTags: defaultRecommendedSearchTags,
        });
      }
      console.error("Error fetching site settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const menuVisibility = data?.menu_visibility
      ? { ...defaultVisibility, ...(data.menu_visibility as any) }
      : defaultVisibility;

    const recommendationSettings = data?.recommendation_settings
      ? mergeRecommendationSettings(data.recommendation_settings as any)
      : defaultRecommendationSettings;

    const rawTags = data?.recommended_search_tags;
    const recommendedSearchTags =
      Array.isArray(rawTags) && rawTags.length
        ? (rawTags as string[]).map((t: string) => (String(t ?? "").trim().startsWith("#") ? String(t).trim() : `#${String(t).trim()}`))
        : defaultRecommendedSearchTags;

    return NextResponse.json({ menuVisibility, recommendationSettings, recommendedSearchTags });
  } catch (e: any) {
    console.error("Unexpected error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
