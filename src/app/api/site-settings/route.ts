import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
      .select("menu_visibility")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching site settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const defaultVisibility = {
      my: true,
      home: true,
      challenge: true,
      ranking: true,
      search: true,
    };

    const menuVisibility = data?.menu_visibility
      ? { ...defaultVisibility, ...(data.menu_visibility as any) }
      : defaultVisibility;

    return NextResponse.json({ menuVisibility });
  } catch (e: any) {
    console.error("Unexpected error:", e);
    return NextResponse.json({ error: e?.message || "Internal server error" }, { status: 500 });
  }
}
