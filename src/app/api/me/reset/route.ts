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

async function resolveUserId(sb: SupabaseClient<any>, args: { pananaId?: string | null; session: any | null }) {
  const session = args.session;

  // 1) 로그인: provider identity 매핑 우선
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
      if (mapped?.user_id) return String(mapped.user_id);
    }
  }

  // 2) fallback: 클라이언트 pananaId
  const pid = args.pananaId && isUuid(args.pananaId) ? String(args.pananaId) : "";
  if (!pid) throw new Error("유저 식별자(pananaId)를 찾을 수 없어요.");

  const { data } = await sb.from("panana_users").select("id").eq("id", pid).maybeSingle<{ id: string }>();
  if (!data?.id) throw new Error("유저 식별자(pananaId)가 DB에 존재하지 않아요. 먼저 /api/me/identity를 호출해 주세요.");
  return pid;
}

const BodySchema = z.object({
  pananaId: z.string().optional(),
  kind: z.enum(["chat", "service"]),
});

async function safeDeleteByUserId(sb: SupabaseClient<any>, table: string, userId: string) {
  try {
    // NOTE: supabase-js 체이닝은 delete()를 먼저 호출한 뒤 필터를 거는 형태가 안전하다.
    const { error } = await sb.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  } catch {
    // 테이블 미생성/권한/스키마 차이 등은 무시(UX 우선)
  }
}

async function safeUpdateUser(sb: SupabaseClient<any>, userId: string, patch: any) {
  try {
    const { error } = await sb.from("panana_users").update(patch).eq("id", userId);
    if (error) throw error;
  } catch {
    // ignore
  }
}

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const sb = getSb();
    const session = await getServerSession(authOptions);
    const userId = await resolveUserId(sb, { pananaId: body.pananaId || null, session });

    // 1) 공통: 대화(DB) 삭제
    await safeDeleteByUserId(sb, "panana_chat_messages", userId);

    // 2) 서비스 이용 완전 초기화: 입국심사/내 정보까지 리셋(포인트는 건드리지 않음)
    if (body.kind === "service") {
      await safeDeleteByUserId(sb, "panana_airport_responses", userId);
      await safeUpdateUser(sb, userId, { birth_yyyymmdd: null, gender: null });
    }

    return NextResponse.json({ ok: true, userId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

