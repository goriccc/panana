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
  if (!data?.id) throw new Error("유저 식별자(pananaId)가 DB에 존재하지 않아요.");
  return pid;
}

const CACHE_CONTROL = "private, max-age=30";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pananaId = url.searchParams.get("pananaId") || undefined;
    const session = await getServerSession(authOptions);
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId, session });
    const { data, error } = await sb
      .from("panana_users")
      .select("profile_note")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const profileNote = (data as any)?.profile_note != null ? String((data as any).profile_note) : null;
    return NextResponse.json(
      { ok: true, profileNote },
      { headers: { "Cache-Control": CACHE_CONTROL } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

const PatchSchema = z.object({
  pananaId: z.string().optional(),
  profileNote: z.string().nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const body = PatchSchema.parse(await req.json());
    const session = await getServerSession(authOptions);
    const sb = getSb();
    const userId = await resolveUserId(sb, { pananaId: body.pananaId ?? null, session });
    const profileNote = body.profileNote !== undefined ? (body.profileNote === null ? null : String(body.profileNote).trim() || null) : undefined;
    if (profileNote === undefined) {
      return NextResponse.json({ ok: false, error: "profileNote is required" }, { status: 400 });
    }
    await sb
      .from("panana_users")
      .update({ profile_note: profileNote })
      .eq("id", userId);
    return NextResponse.json({ ok: true, profileNote });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}
