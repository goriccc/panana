import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
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
  // 예: 보라색파인애플0123
  const colors = ["보라색", "하늘색", "초록색", "분홍색", "노란색", "빨간색", "파란색", "검은색", "하얀색", "주황색"];
  const fruits = ["파인애플", "바나나", "사과", "딸기", "복숭아", "포도", "레몬", "체리", "망고", "키위"];
  const c = colors[randomInt(colors.length)];
  const f = fruits[randomInt(fruits.length)];
  return `${c}${f}${randomDigits(4)}`;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

async function ensureUserById(sb: SupabaseClient<any>, userId?: string | null) {
  const id = userId && isUuid(userId) ? userId : null;
  if (id) {
    const { data } = await sb
      .from("panana_users")
      .select("id, handle, nickname")
      .eq("id", id)
      .maybeSingle<{ id: string; handle: string | null; nickname: string | null }>();
    if (data?.id) {
      const nick = String((data as any).nickname || "").trim();
      if (nick) return { id: String(data.id), handle: String(data.handle || ""), nickname: nick };
      // nickname이 비어있으면 보정
      const newNick = generateNickname();
      await sb.from("panana_users").update({ nickname: newNick }).eq("id", data.id);
      return { id: String(data.id), handle: String(data.handle || ""), nickname: newNick };
    }
  }

  // 신규 생성: handle UNIQUE 보장 위해 충돌 시 재시도
  for (let i = 0; i < 16; i++) {
    const handle = generateHandle();
    const payload: any = { handle, nickname: generateNickname() };
    if (id) payload.id = id;
    const { data, error } = await sb.from("panana_users").insert(payload).select("id, handle, nickname").single();
    if (!error && data?.id) {
      return { id: String((data as any).id), handle: String((data as any).handle || ""), nickname: String((data as any).nickname || "") };
    }
    // unique 충돌 등 -> 재시도
  }
  throw new Error("고유번호 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const session = await getServerSession(authOptions);
    const body = (await req.json().catch(() => ({}))) as any;
    const clientPananaId = body?.pananaId ? String(body.pananaId) : null;

    // 1) 로그인된 경우: provider identity로 기존 매핑이 있으면 그 user를 우선 사용
    if (session) {
      const provider = String((session as any)?.provider || "").toLowerCase();
      const providerAccountId = String((session as any)?.providerAccountId || "");

      if (provider && providerAccountId) {
        const { data: mapped } = await sb
          .from("panana_user_identities")
          .select("user_id")
          .eq("provider", provider)
          .eq("provider_account_id", providerAccountId)
          .maybeSingle();

        if (mapped?.user_id) {
          const { data: u } = await sb
            .from("panana_users")
            .select("id, handle, nickname")
            .eq("id", mapped.user_id)
            .maybeSingle<{ id: string; handle: string | null; nickname: string | null }>();
          if (u?.id) return NextResponse.json({ ok: true, id: String((u as any).id), handle: String((u as any).handle || ""), nickname: String((u as any).nickname || "") });
        }
      }

      // 매핑이 없으면: 클라이언트 pananaId로 유저를 확정/생성 후 연결
      const u = await ensureUserById(sb, clientPananaId);

      if (provider && providerAccountId) {
        // upsert: provider+accountId는 유니크
        await sb
          .from("panana_user_identities")
          .upsert(
            { user_id: u.id, provider, provider_account_id: providerAccountId },
            { onConflict: "provider,provider_account_id" }
          );
      }
      return NextResponse.json({ ok: true, id: u.id, handle: u.handle, nickname: (u as any).nickname || "" });
    }

    // 2) 비로그인: 클라이언트 pananaId가 있으면 그걸로, 없으면 신규 생성
    const u = await ensureUserById(sb, clientPananaId);
    return NextResponse.json({ ok: true, id: u.id, handle: u.handle, nickname: (u as any).nickname || "" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

