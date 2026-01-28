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

  const pid = args.pananaId && isUuid(args.pananaId) ? String(args.pananaId) : "";
  if (!pid) throw new Error("유저 식별자(pananaId)를 찾을 수 없어요.");

  const { data } = await sb.from("panana_users").select("id").eq("id", pid).maybeSingle<{ id: string }>();
  if (!data?.id) throw new Error("유저 식별자(pananaId)가 DB에 존재하지 않아요. 먼저 /api/me/identity를 호출해 주세요.");
  return pid;
}

function calcAge(birth: string | null) {
  if (!birth || birth.length !== 8) return null;
  const y = Number(birth.slice(0, 4));
  const m = Number(birth.slice(4, 6));
  const d = Number(birth.slice(6, 8));
  if (!y || !m || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const mm = now.getMonth() + 1;
  const dd = now.getDate();
  if (mm < m || (mm === m && dd < d)) age -= 1;
  return age;
}

const BodySchema = z.object({
  pananaId: z.string().optional(),
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
      .select("adult_verified, adult_verified_at, birth_yyyymmdd")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      adultVerified: Boolean((data as any)?.adult_verified),
      adultVerifiedAt: (data as any)?.adult_verified_at || null,
      birth: (data as any)?.birth_yyyymmdd ? String((data as any).birth_yyyymmdd) : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const session = await getServerSession(authOptions);
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: body.pananaId || null, session });

    const { data, error } = await sb
      .from("panana_users")
      .select("adult_verified, birth_yyyymmdd")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;

    if (Boolean((data as any)?.adult_verified)) {
      return NextResponse.json({ ok: true, already: true });
    }

    const birth = (data as any)?.birth_yyyymmdd ? String((data as any).birth_yyyymmdd) : null;
    const age = calcAge(birth);
    if (!age && age !== 0) {
      return NextResponse.json({ ok: false, error: "생년월일이 필요합니다. 내 정보에서 등록해 주세요." }, { status: 400 });
    }
    if (age < 19) {
      return NextResponse.json({ ok: false, error: "만 19세 이상만 이용할 수 있어요." }, { status: 400 });
    }

    await sb
      .from("panana_users")
      .update({ adult_verified: true, adult_verified_at: new Date().toISOString() })
      .eq("id", userId);

    return NextResponse.json({ ok: true, adultVerified: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
