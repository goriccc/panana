import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const BodySchema = z.object({
  studioCharacterId: z.string().min(1),
  nsfwFilterOff: z.boolean(),
});

function getSupabaseAuthed(req: Request) {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = mustEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing Authorization token");
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function getSupabaseAdmin() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** 어드민 "스파이시 지원" 체크 시 Studio 오서노트 NSFW 필터 해제 연동 */
export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const supabase = getSupabaseAuthed(req);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user?.id) {
      return NextResponse.json({ ok: false, error: "로그인이 필요해요." }, { status: 401 });
    }

    const { data: allow } = await supabase
      .from("panana_admin_users")
      .select("active")
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (!allow?.active) {
      return NextResponse.json({ ok: false, error: "권한이 없어요." }, { status: 403 });
    }

    const sb = getSupabaseAdmin();

    const { data: char, error: charErr } = await sb
      .from("characters")
      .select("id, project_id")
      .eq("id", body.studioCharacterId)
      .maybeSingle();
    if (charErr || !char) {
      return NextResponse.json({ ok: false, error: "Studio 캐릭터를 찾을 수 없어요." }, { status: 404 });
    }

    const { data: promptRow, error: promptErr } = await sb
      .from("character_prompts")
      .select("payload, created_by")
      .eq("character_id", body.studioCharacterId)
      .maybeSingle();
    if (promptErr) throw promptErr;

    const currentPayload = (promptRow?.payload as Record<string, unknown>) || {};
    const author = (currentPayload.author as Record<string, unknown>) || {};
    const nextPayload = {
      ...currentPayload,
      author: { ...author, nsfwFilterOff: body.nsfwFilterOff },
    };

    const { error: upErr } = await sb
      .from("character_prompts")
      .upsert(
        {
          project_id: char.project_id,
          character_id: body.studioCharacterId,
          payload: nextPayload,
          status: (promptRow as any)?.status || "draft",
          created_by: (promptRow as any)?.created_by || userRes.user.id,
        },
        { onConflict: "character_id" }
      );
    if (upErr) throw upErr;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Studio 연동에 실패했어요." }, { status: 500 });
  }
}
