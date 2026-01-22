import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth/authOptions";

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

async function ensureUserById(sb: SupabaseClient<any>, userId?: string | null) {
  const id = userId && isUuid(userId) ? userId : null;
  if (id) {
    const { data } = await sb
      .from("panana_users")
      .select("id")
      .eq("id", id)
      .maybeSingle<{ id: string }>();
    if (data?.id) return id;
  }

  // ID가 없으면 닉네임 업데이트가 불가능하므로, 여기서는 실패
  throw new Error("유저 식별자(pananaId)를 찾을 수 없어요.");
}

const BodySchema = z.object({
  nickname: z.string().min(1).max(10),
  pananaId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const nick = String(body.nickname || "").trim().slice(0, 10);
    if (!nick) return NextResponse.json({ ok: false, error: "닉네임을 입력해 주세요." }, { status: 400 });

    const sb = getSb();
    const session = await getServerSession(authOptions);

    // 1) 로그인: provider identity 매핑이 있으면 그 user_id를 우선 사용
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
          const userId = String(mapped.user_id);
          await sb.from("panana_users").update({ nickname: nick }).eq("id", userId);
          return NextResponse.json({ ok: true, userId });
        }
      }
    }

    // 2) fallback: 클라이언트가 보내준 pananaId로 업데이트(비로그인/매핑 미완료)
    const userId = await ensureUserById(sb, body.pananaId || null);
    await sb.from("panana_users").update({ nickname: nick }).eq("id", userId);
    return NextResponse.json({ ok: true, userId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

