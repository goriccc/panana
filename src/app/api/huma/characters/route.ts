import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PananaCharacterRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  active: boolean;
  intro_title: string;
  intro_lines: string[] | null;
  mood_title: string;
  mood_lines: string[] | null;
  mbti: string;
  gender: string | null;
  studio_character_id: string | null;
};

type StudioPromptPayload = {
  system?: {
    personalitySummary?: string;
    speechGuide?: string;
    coreDesire?: string;
  };
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getSupabaseAdmin() {
  return createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

function checkHumaAuth(req: NextRequest): boolean {
  const expected = process.env.PANANA_HUMA_API_KEY?.trim();
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = req.headers.get("authorization") || "";
  const apiKey = req.headers.get("x-api-key") || "";
  return auth === `Bearer ${expected}` || apiKey === expected;
}

function buildCharacterDescription(
  row: PananaCharacterRow,
  studioPrompt?: StudioPromptPayload | null,
): string {
  const parts: string[] = [];

  if (row.tagline?.trim()) parts.push(`한줄: ${row.tagline.trim()}`);
  if (row.mbti?.trim()) parts.push(`MBTI: ${row.mbti.trim()}`);
  if (row.gender === "male" || row.gender === "female") {
    parts.push(`성별: ${row.gender === "male" ? "남성" : "여성"}`);
  }
  if (row.intro_lines?.length) {
    const intro = row.intro_lines.map((l) => String(l).trim()).filter(Boolean).join(" ");
    if (intro) parts.push(`${row.intro_title || "소개"}: ${intro}`);
  }
  if (row.mood_lines?.length) {
    const mood = row.mood_lines.map((l) => String(l).trim()).filter(Boolean).join(" ");
    if (mood) parts.push(`${row.mood_title || "요즘"}: ${mood}`);
  }

  const system = studioPrompt?.system;
  if (system?.personalitySummary?.trim()) parts.push(`성격: ${system.personalitySummary.trim()}`);
  if (system?.speechGuide?.trim()) parts.push(`말투: ${system.speechGuide.trim()}`);
  if (system?.coreDesire?.trim()) parts.push(`욕망: ${system.coreDesire.trim()}`);

  return parts.join("\n").trim() || row.tagline?.trim() || row.name;
}

/**
 * HUMA 영상 콘텐츠 파이프라인용 캐릭터 목록.
 * GET → [{ id, name, description?, status: 'active'|'inactive' }]
 * 인증: Authorization: Bearer PANANA_HUMA_API_KEY 또는 x-api-key (HUMA의 PANANA_CHARACTER_API_KEY와 동일 값)
 */
export async function GET(req: NextRequest) {
  if (!checkHumaAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const sb = getSupabaseAdmin();
    const { data: chars, error } = await sb
      .from("panana_characters")
      .select(
        "id, slug, name, tagline, active, intro_title, intro_lines, mood_title, mood_lines, mbti, gender, studio_character_id",
      )
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (chars ?? []) as PananaCharacterRow[];
    const studioIds = [
      ...new Set(rows.map((c) => c.studio_character_id).filter((id): id is string => Boolean(id))),
    ];

    const promptByStudioId = new Map<string, StudioPromptPayload>();
    if (studioIds.length) {
      const { data: prompts } = await sb
        .from("character_prompts")
        .select("character_id, payload")
        .in("character_id", studioIds);
      for (const p of prompts ?? []) {
        if (p.character_id) {
          promptByStudioId.set(p.character_id, (p.payload as StudioPromptPayload) ?? {});
        }
      }
    }

    const result = rows.map((ch) => ({
      id: ch.id,
      name: ch.name,
      description: buildCharacterDescription(
        ch,
        ch.studio_character_id ? promptByStudioId.get(ch.studio_character_id) : null,
      ),
      status: ch.active ? ("active" as const) : ("inactive" as const),
    }));

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
