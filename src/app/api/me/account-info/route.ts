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

function normBirth(input: string | null | undefined) {
  const v = String(input || "").replace(/[^\d]/g, "").slice(0, 8);
  return v.length === 8 ? v : null;
}

function normGender(input: string | null | undefined) {
  const v = String(input || "").trim();
  if (!v) return null;
  if (v === "female" || v === "male" || v === "both" || v === "private") return v;
  return null;
}

const UpdateSchema = z.object({
  pananaId: z.string().optional(),
  birth: z.string().optional(),
  gender: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pananaId = url.searchParams.get("pananaId") || undefined;
    const session = await getServerSession(authOptions);
    const sb = getSb();

    const userId = await resolveUserId(sb, { pananaId, session });
    const { data, error } = await sb
      .from("panana_users")
      .select("birth_yyyymmdd, gender")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      birth: (data as any)?.birth_yyyymmdd ? String((data as any).birth_yyyymmdd) : null,
      gender: (data as any)?.gender ? String((data as any).gender) : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = UpdateSchema.parse(await req.json());
    const session = await getServerSession(authOptions);
    const sb = getSb();

    const userId = await resolveUserId(sb, { pananaId: body.pananaId || null, session });
    const birth = normBirth(body.birth);
    const gender = normGender(body.gender);

    await sb
      .from("panana_users")
      .update({
        birth_yyyymmdd: birth,
        gender,
      })
      .eq("id", userId);

    return NextResponse.json({ ok: true, userId, birth, gender });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

