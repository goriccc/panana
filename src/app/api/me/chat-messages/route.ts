import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

function getSb() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

function randomInt(maxExclusive: number) {
  return Math.floor(Math.random() * maxExclusive);
}

function randomLetters(n: number) {
  const alpha = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < n; i++) out += alpha[randomInt(alpha.length)];
  return out;
}

function randomDigits(n: number) {
  let out = "";
  for (let i = 0; i < n; i++) out += String(randomInt(10));
  return out;
}

function generateHandle() {
  return `@${randomLetters(4)}${randomDigits(4)}`;
}

function generateNickname() {
  const colors = ["보라색", "하늘색", "초록색", "분홍색", "노란색", "빨간색", "파란색", "검은색", "하얀색", "주황색"];
  const fruits = ["파인애플", "바나나", "사과", "딸기", "복숭아", "포도", "레몬", "체리", "망고", "키위"];
  return `${colors[randomInt(colors.length)]}${fruits[randomInt(fruits.length)]}${randomDigits(4)}`;
}

async function ensurePananaUser(sb: SupabaseClient<any>, pananaId: string) {
  // FK(user_id) 때문에 panana_users row가 반드시 있어야 한다.
  const { data: u, error: selErr } = await sb
    .from("panana_users")
    .select("id")
    .eq("id", pananaId)
    .maybeSingle<{ id: string }>();
  if (selErr) throw selErr;
  if (u?.id) return;

  // 신규 생성: handle UNIQUE 충돌 시 재시도
  for (let i = 0; i < 16; i++) {
    const { error } = await sb
      .from("panana_users")
      .insert({ id: pananaId, handle: generateHandle(), nickname: generateNickname() } as any);
    if (!error) return;
  }
  throw new Error("panana_users 생성에 실패했어요.");
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pananaId = String(url.searchParams.get("pananaId") || "");
    const characterSlug = String(url.searchParams.get("characterSlug") || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 120) || 120));
    if (!isUuid(pananaId)) return NextResponse.json({ ok: false, error: "Invalid pananaId" }, { status: 400 });
    if (!characterSlug) return NextResponse.json({ ok: false, error: "Missing characterSlug" }, { status: 400 });

    const sb = getSb();
    await ensurePananaUser(sb, pananaId);
    const { data, error } = await sb
      .from("panana_chat_messages")
      .select("client_msg_id, from_role, text, at_ms, created_at, scene_image_url")
      .eq("user_id", pananaId)
      .eq("character_slug", characterSlug)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    const messages = (data || []).map((r: any) => ({
      id: String(r.client_msg_id || ""),
      from: String(r.from_role || "system"),
      text: String(r.text || ""),
      at: r.at_ms == null ? null : Number(r.at_ms) || null,
      createdAt: String(r.created_at || ""),
      sceneImageUrl: r.scene_image_url ? String(r.scene_image_url).trim() : null,
    }));

    return NextResponse.json({ ok: true, messages });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const pananaId = String(body?.pananaId || "");
    const characterSlug = String(body?.characterSlug || "").trim().toLowerCase();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (!isUuid(pananaId)) return NextResponse.json({ ok: false, error: "Invalid pananaId" }, { status: 400 });
    if (!characterSlug) return NextResponse.json({ ok: false, error: "Missing characterSlug" }, { status: 400 });

    const sb = getSb();
    await ensurePananaUser(sb, pananaId);

    const rows = messages
      .map((m: any) => {
        const id = String(m?.id || "").trim();
        const from = String(m?.from || "").trim();
        const text = String(m?.text || "").trim();
        const at = m?.at == null ? null : Number(m.at) || null;
        const sceneImageUrl = m?.sceneImageUrl ? String(m.sceneImageUrl).trim() : null;
        if (!id || !text) return null;
        if (from !== "bot" && from !== "user" && from !== "system") return null;
        const row: Record<string, unknown> = {
          user_id: pananaId,
          character_slug: characterSlug,
          client_msg_id: id,
          from_role: from,
          text,
          at_ms: at,
        };
        if (sceneImageUrl) row.scene_image_url = sceneImageUrl;
        return row;
      })
      .filter(Boolean) as any[];

    if (!rows.length) return NextResponse.json({ ok: true, saved: 0 });

    const { error } = await sb.from("panana_chat_messages").upsert(rows, { onConflict: "user_id,character_slug,client_msg_id" });
    if (error) throw error;

    // 간단한 보관 정책: 최근 500개만 유지(초과분은 삭제)
    const { data: oldIds } = await sb
      .from("panana_chat_messages")
      .select("id")
      .eq("user_id", pananaId)
      .eq("character_slug", characterSlug)
      .order("created_at", { ascending: false })
      .range(500, 2000);
    const ids = (oldIds || []).map((r: any) => String(r.id)).filter(Boolean);
    if (ids.length) {
      await sb.from("panana_chat_messages").delete().in("id", ids);
    }

    return NextResponse.json({ ok: true, saved: rows.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

