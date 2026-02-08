import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

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

function getDateRange(period: string, fromParam?: string | null, toParam?: string | null) {
  const now = new Date();
  let from: Date;
  let to: Date = new Date(now);
  if (period === "custom" && fromParam && toParam) {
    from = new Date(fromParam);
    to = new Date(toParam);
  } else if (period === "day") {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    from = new Date(now);
    from.setDate(from.getDate() - 7);
  } else if (period === "month") {
    from = new Date(now);
    from.setMonth(from.getMonth() - 1);
  } else {
    from = new Date(0); // all
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function ageBand(birthYyyymmdd: string | null): string | null {
  if (!birthYyyymmdd || birthYyyymmdd.length < 4) return null;
  const y = parseInt(birthYyyymmdd.slice(0, 4), 10);
  if (Number.isNaN(y)) return null;
  const age = new Date().getFullYear() - y;
  if (age < 10) return "10s";
  if (age < 20) return "10s";
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  return "60+";
}

function normGender(g: string | null): "male" | "female" | "both" | "private" {
  if (g === "male" || g === "female" || g === "both" || g === "private") return g;
  return "private";
}

export async function GET(req: Request) {
  try {
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

    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "all";
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const { from: fromIso, to: toIso } = getDateRange(period, fromParam, toParam);

    const sb = getSupabaseAdmin();

    const [inflow, usersByGender, airportRows, chatMsgRows, userRows, characterRows, sceneImageLog] =
      await Promise.all([
        fetchInflow(sb, fromIso, toIso),
        fetchUsersByGender(sb),
        fetchAirportWithUsers(sb),
        fetchChatMessagesInRange(sb, fromIso, toIso),
        fetchAllUsers(sb),
        fetchCharacters(sb),
        fetchSceneImageLog(sb, fromIso, toIso),
      ]);

    const airportAgeByGender = computeAirportAgeByGender(airportRows);
    const chatUsersByPeriodGender = computeChatUsersByGender(chatMsgRows, userRows, fromIso, toIso, period);
    const avgDwellByGender = computeAvgDwellByGender(sb, userRows, chatMsgRows, airportRows);
    const avgChatDurationByGender = computeAvgChatDurationByGender(chatMsgRows, userRows);
    const characterCounts = computeCharacterCounts(characterRows);
    const popularCharacters = await computePopularCharacters(sb, characterRows, fromIso, toIso);
    const characterAvgChatByGender = computeCharacterAvgChatByGender(chatMsgRows, userRows);
    const characterAgeByGender = computeCharacterAgeByGender(chatMsgRows, userRows);
    const airportStepRatios = computeAirportStepRatios(airportRows);
    const sceneImageTop = computeSceneImageTopByCharacter(characterRows, sceneImageLog.rows);

    const inflowByPeriod =
      period === "all"
        ? inflow
        : await fetchInflowByPeriod(sb, period, fromIso, toIso);

    const characterMeta: Record<string, { name: string; profile_image_url: string }> = {};
    characterRows.forEach((c) => {
      characterMeta[c.slug] = {
        name: c.name ?? c.slug,
        profile_image_url: c.profile_image_url ?? "",
      };
    });

    const popularWithMeta = {
      male: (popularCharacters.male ?? []).map((p) => ({
        ...p,
        name: characterMeta[p.slug]?.name ?? p.slug,
        profile_image_url: characterMeta[p.slug]?.profile_image_url ?? "",
      })),
      female: (popularCharacters.female ?? []).map((p) => ({
        ...p,
        name: characterMeta[p.slug]?.name ?? p.slug,
        profile_image_url: characterMeta[p.slug]?.profile_image_url ?? "",
      })),
    };

    return NextResponse.json({
      ok: true,
      period,
      from: fromIso,
      to: toIso,
      inflow: { ...inflow, byPeriod: inflowByPeriod },
      usersByGender,
      airportAgeByGender,
      chatUsersByPeriodGender,
      avgDwellByGender,
      avgChatDurationByGender,
      characterCounts,
      popularCharacters: popularWithMeta,
      characterMeta,
      characterAvgChatByGender,
      characterAgeByGender,
      airportStepRatios,
      sceneImageCounts: {
        total: sceneImageLog.total,
        male: (sceneImageTop.male ?? []).map((p) => ({
          ...p,
          name: characterMeta[p.slug]?.name ?? p.slug,
          profile_image_url: characterMeta[p.slug]?.profile_image_url ?? "",
        })),
        female: (sceneImageTop.female ?? []).map((p) => ({
          ...p,
          name: characterMeta[p.slug]?.name ?? p.slug,
          profile_image_url: characterMeta[p.slug]?.profile_image_url ?? "",
        })),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function fetchInflow(
  sb: SupabaseClient<any>,
  fromIso: string,
  toIso: string
): Promise<{ total: number; unique: number }> {
  try {
    const { data: rows, error } = await sb
      .from("panana_visits")
      .select("id, visitor_id, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    if (error) return { total: 0, unique: 0 };
    const total = rows?.length ?? 0;
    const uniq = new Set(rows?.map((r: { visitor_id?: string | null; id?: string }) => r.visitor_id ?? r.id) ?? []);
    return { total, unique: uniq.size };
  } catch {
    return { total: 0, unique: 0 };
  }
}

async function fetchInflowByPeriod(
  sb: SupabaseClient<any>,
  period: string,
  fromIso: string,
  toIso: string
): Promise<{ total: number; unique: number }> {
  return fetchInflow(sb, fromIso, toIso);
}

async function fetchUsersByGender(
  sb: SupabaseClient<any>
): Promise<{ total: number; male: number; female: number; both: number; private: number; byGender: Array<{ label: string; count: number; ratio: number }> }> {
  const { data: rows, error } = await sb.from("panana_users").select("gender");
  if (error) throw error;
  const total = rows?.length ?? 0;
  const male = rows?.filter((r: { gender?: string | null }) => r.gender === "male").length ?? 0;
  const female = rows?.filter((r: { gender?: string | null }) => r.gender === "female").length ?? 0;
  const both = rows?.filter((r: { gender?: string | null }) => r.gender === "both").length ?? 0;
  const privateCount = total - male - female - both;
  const byGender = [
    { label: "남성", count: male, ratio: total ? male / total : 0 },
    { label: "여성", count: female, ratio: total ? female / total : 0 },
    { label: "둘다 선택", count: both, ratio: total ? both / total : 0 },
    { label: "선택안함", count: privateCount, ratio: total ? privateCount / total : 0 },
  ].filter((r) => r.count > 0);
  return { total, male, female, both, private: privateCount, byGender };
}

type UserRow = { id: string; gender: string | null; birth_yyyymmdd: string | null; created_at?: string };
type AirportRow = { user_id: string; purpose: string; mood: string; character_type: string; updated_at?: string };
type ChatRow = { user_id: string; character_slug: string; created_at: string };
type CharacterRow = { id: string; slug: string; name: string; profile_image_url: string; gender: string | null };

async function fetchAirportWithUsers(
  sb: SupabaseClient<any>
): Promise<Array<AirportRow & { gender: string | null; birth_yyyymmdd: string | null }>> {
  const { data: ar, error: ae } = await sb
    .from("panana_airport_responses")
    .select("user_id, purpose, mood, character_type, updated_at");
  if (ae || !ar?.length) return [];
  const ids = [...new Set(ar.map((r: { user_id: string }) => r.user_id))];
  const { data: users } = await sb.from("panana_users").select("id, gender, birth_yyyymmdd").in("id", ids);
  const userMap = new Map((users ?? []).map((u: UserRow) => [u.id, u]));
  return ar.map((a: AirportRow) => {
    const u = userMap.get(a.user_id) as UserRow | undefined;
    return { ...a, gender: u?.gender ?? null, birth_yyyymmdd: u?.birth_yyyymmdd ?? null };
  });
}

async function fetchChatMessagesInRange(
  sb: SupabaseClient<any>,
  fromIso: string,
  toIso: string
): Promise<ChatRow[]> {
  const { data, error } = await sb
    .from("panana_chat_messages")
    .select("user_id, character_slug, created_at")
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  if (error) return [];
  return (data ?? []) as ChatRow[];
}

async function fetchAllUsers(sb: SupabaseClient<any>): Promise<UserRow[]> {
  const { data, error } = await sb.from("panana_users").select("id, gender, birth_yyyymmdd, created_at");
  if (error) return [];
  return (data ?? []) as UserRow[];
}

async function fetchCharacters(sb: SupabaseClient<any>): Promise<CharacterRow[]> {
  const { data, error } = await sb
    .from("panana_characters")
    .select("id, slug, name, profile_image_url, gender");
  if (error) return [];
  return (data ?? []) as CharacterRow[];
}

type SceneImageLogRow = { character_slug: string | null };

async function fetchSceneImageLog(
  sb: SupabaseClient<any>,
  fromIso: string,
  toIso: string
): Promise<{ total: number; rows: SceneImageLogRow[] }> {
  try {
    const { count, error } = await sb
      .from("panana_scene_image_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    if (error) return { total: 0, rows: [] };
    const total = count ?? 0;
    try {
      const { data: rows, error: rowsError } = await sb
        .from("panana_scene_image_log")
        .select("character_slug")
        .gte("created_at", fromIso)
        .lte("created_at", toIso);
      if (rowsError) return { total, rows: [] };
      return { total, rows: (rows ?? []) as SceneImageLogRow[] };
    } catch {
      return { total, rows: [] };
    }
  } catch {
    return { total: 0, rows: [] };
  }
}

function computeSceneImageTopByCharacter(
  characterRows: CharacterRow[],
  sceneImageRows: SceneImageLogRow[]
): {
  male: Array<{ slug: string; imageCount: number }>;
  female: Array<{ slug: string; imageCount: number }>;
} {
  const bySlug = new Map<string, number>();
  for (const r of sceneImageRows) {
    const slug = r.character_slug?.trim();
    if (!slug) continue;
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + 1);
  }
  const maleSlugs = characterRows.filter((c) => c.gender === "male").map((c) => c.slug);
  const femaleSlugs = characterRows.filter((c) => c.gender === "female").map((c) => c.slug);
  const top = (slugs: string[], n: number) =>
    slugs
      .map((slug) => ({ slug, imageCount: bySlug.get(slug) ?? 0 }))
      .filter((x) => x.imageCount > 0)
      .sort((a, b) => b.imageCount - a.imageCount)
      .slice(0, n);
  return { male: top(maleSlugs, 20), female: top(femaleSlugs, 20) };
}

function computeAirportAgeByGender(
  rows: Array<{ gender: string | null; birth_yyyymmdd: string | null }>
): Record<string, Record<string, number> & { total?: Record<string, number> }> {
  const bands = ["10s", "20s", "30s", "40s", "50s", "60+"] as const;
  const genders = ["male", "female", "both", "private"] as const;
  const byGender: Record<string, Record<string, number>> = {};
  const totalBand: Record<string, number> = {};
  bands.forEach((b) => (totalBand[b] = 0));
  genders.forEach((g) => {
    byGender[g] = {};
    bands.forEach((b) => (byGender[g][b] = 0));
  });
  for (const r of rows) {
    const band = ageBand(r.birth_yyyymmdd);
    const g = normGender(r.gender);
    if (!band) continue;
    if (byGender[g]) byGender[g][band] = (byGender[g][band] ?? 0) + 1;
    totalBand[band] = (totalBand[band] ?? 0) + 1;
  }
  const totalSum = Object.values(totalBand).reduce((a, b) => a + b, 0);
  const totalRatio: Record<string, number> = {};
  bands.forEach((b) => (totalRatio[b] = totalSum ? (totalBand[b] ?? 0) / totalSum : 0));
  return { ...byGender, total: totalRatio };
}

function computeChatUsersByGender(
  chatRows: ChatRow[],
  userRows: UserRow[],
  _from: string,
  _to: string,
  _period: string
): { total: number; male: number; female: number; both: number; private: number } {
  const userIds = new Set(chatRows.map((r) => r.user_id));
  const userMap = new Map(userRows.map((u) => [u.id, u]));
  let male = 0,
    female = 0,
    both = 0,
    privateCount = 0;
  userIds.forEach((id) => {
    const u = userMap.get(id);
    const g = normGender(u?.gender ?? null);
    if (g === "male") male++;
    else if (g === "female") female++;
    else if (g === "both") both++;
    else privateCount++;
  });
  return { total: userIds.size, male, female, both, private: privateCount };
}

function computeAvgDwellByGender(
  _sb: SupabaseClient<any>,
  userRows: UserRow[],
  chatRows: ChatRow[],
  airportRows: Array<AirportRow & { gender: string | null; birth_yyyymmdd: string | null }>
): Record<string, number> {
  const lastChat = new Map<string, number>();
  for (const r of chatRows) {
    const t = new Date(r.created_at).getTime();
    if (!lastChat.has(r.user_id) || lastChat.get(r.user_id)! < t) lastChat.set(r.user_id, t);
  }
  const lastAirport = new Map<string, number>();
  for (const r of airportRows) {
    if (r.updated_at) {
      const t = new Date(r.updated_at).getTime();
      if (!lastAirport.has(r.user_id) || lastAirport.get(r.user_id)! < t) lastAirport.set(r.user_id, t);
    }
  }
  const createdMap = new Map(
    userRows.map((u) => [u.id, new Date(u.created_at ?? 0).getTime()])
  );
  const dwellByUser = new Map<string, number>();
  for (const uid of createdMap.keys()) {
    const created = createdMap.get(uid) ?? 0;
    const lastC = lastChat.get(uid) ?? 0;
    const lastA = lastAirport.get(uid) ?? 0;
    const last = Math.max(lastC, lastA);
    if (last > created) dwellByUser.set(uid, (last - created) / 1000 / 60); // minutes
  }
  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const byGender: Record<string, number[]> = { male: [], female: [], both: [], private: [] };
  dwellByUser.forEach((mins, uid) => {
    const g = normGender(userMap.get(uid)?.gender ?? null);
    if (byGender[g]) byGender[g].push(mins);
  });
  return {
    male: avg(byGender.male),
    female: avg(byGender.female),
    both: avg(byGender.both),
    private: avg(byGender.private),
  };
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeAvgChatDurationByGender(
  chatRows: ChatRow[],
  userRows: UserRow[]
): Record<string, number> {
  const byUserChar = new Map<string, { min: number; max: number }>();
  for (const r of chatRows) {
    const key = `${r.user_id}:${r.character_slug}`;
    const t = new Date(r.created_at).getTime();
    const cur = byUserChar.get(key);
    if (!cur) byUserChar.set(key, { min: t, max: t });
    else {
      if (t < cur.min) cur.min = t;
      if (t > cur.max) cur.max = t;
    }
  }
  const durationByUser = new Map<string, number[]>();
  byUserChar.forEach((v, key) => {
    const uid = key.split(":")[0];
    const dur = (v.max - v.min) / 1000 / 60;
    if (!durationByUser.has(uid)) durationByUser.set(uid, []);
    durationByUser.get(uid)!.push(dur);
  });
  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const byGender: Record<string, number[]> = { male: [], female: [], both: [], private: [] };
  durationByUser.forEach((durations, uid) => {
    const g = normGender(userMap.get(uid)?.gender ?? null);
    const avgDur = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    if (byGender[g]) byGender[g].push(avgDur);
  });
  return {
    male: avg(byGender.male),
    female: avg(byGender.female),
    both: avg(byGender.both),
    private: avg(byGender.private),
  };
}

function computeCharacterCounts(
  rows: CharacterRow[]
): { total: number; male: number; female: number } {
  const male = rows.filter((r) => r.gender === "male").length;
  const female = rows.filter((r) => r.gender === "female").length;
  return { total: rows.length, male, female };
}

async function computePopularCharacters(
  sb: SupabaseClient<any>,
  characterRows: CharacterRow[],
  _fromIso: string,
  _toIso: string
): Promise<{ male: Array<{ slug: string; name?: string; userCount: number; avgDurationMin: number }>; female: Array<{ slug: string; name?: string; userCount: number; avgDurationMin: number }> }> {
  const now = new Date();
  const from30d = new Date(now);
  from30d.setDate(from30d.getDate() - 30);
  const fromIso = from30d.toISOString();
  const toIso = now.toISOString();
  const { data: chatRows } = await sb
    .from("panana_chat_messages")
    .select("user_id, character_slug, created_at")
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  const list = (chatRows ?? []) as ChatRow[];
  const charGender = new Map(characterRows.map((c) => [c.slug, c.gender]));
  const bySlug = new Map<
    string,
    { userIds: Set<string>; times: number[] }
  >();
  const byUserChar = new Map<string, { min: number; max: number }>();
  for (const r of list) {
    const key = `${r.user_id}:${r.character_slug}`;
    const t = new Date(r.created_at).getTime();
    let cur = byUserChar.get(key);
    if (!cur) {
      cur = { min: t, max: t };
      byUserChar.set(key, cur);
    } else {
      if (t < cur.min) cur.min = t;
      if (t > cur.max) cur.max = t;
    }
  }
  byUserChar.forEach((v, key) => {
    const [, slug] = key.split(":");
    const dur = (v.max - v.min) / 1000 / 60;
    if (!bySlug.has(slug)) bySlug.set(slug, { userIds: new Set(), times: [] });
    const ent = bySlug.get(slug)!;
    ent.times.push(dur);
    ent.userIds.add(key.split(":")[0]);
  });
  const maleSlugs = characterRows.filter((c) => c.gender === "male").map((c) => c.slug);
  const femaleSlugs = characterRows.filter((c) => c.gender === "female").map((c) => c.slug);
  const top = (slugs: string[], n: number) =>
    slugs
      .map((slug) => {
        const ent = bySlug.get(slug);
        if (!ent) return { slug, userCount: 0, avgDurationMin: 0 };
        return {
          slug,
          userCount: ent.userIds.size,
          avgDurationMin: ent.times.length ? ent.times.reduce((a, b) => a + b, 0) / ent.times.length : 0,
        };
      })
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, n);
  return { male: top(maleSlugs, 20), female: top(femaleSlugs, 20) };
}


function computeCharacterAvgChatByGender(
  chatRows: ChatRow[],
  userRows: UserRow[]
): Array<{ character_slug: string; male: number; female: number; both: number; private: number }> {
  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const byUserChar = new Map<string, { min: number; max: number }>();
  for (const r of chatRows) {
    const key = `${r.user_id}:${r.character_slug}`;
    const t = new Date(r.created_at).getTime();
    const cur = byUserChar.get(key);
    if (!cur) byUserChar.set(key, { min: t, max: t });
    else {
      if (t < cur.min) cur.min = t;
      if (t > cur.max) cur.max = t;
    }
  }
  const byCharGender = new Map<string, Record<string, number[]>>();
  byUserChar.forEach((v, key) => {
    const [uid, slug] = key.split(":");
    const g = normGender(userMap.get(uid)?.gender ?? null);
    const dur = (v.max - v.min) / 1000 / 60;
    if (!byCharGender.has(slug)) byCharGender.set(slug, { male: [], female: [], both: [], private: [] });
    const ent = byCharGender.get(slug)!;
    if (ent[g]) ent[g].push(dur);
  });
  const result: Array<{ character_slug: string; male: number; female: number; both: number; private: number }> = [];
  byCharGender.forEach((d, character_slug) => {
    result.push({
      character_slug,
      male: avg(d.male),
      female: avg(d.female),
      both: avg(d.both),
      private: avg(d.private),
    });
  });
  return result.sort((a, b) => a.character_slug.localeCompare(b.character_slug));
}

function computeCharacterAgeByGender(
  chatRows: ChatRow[],
  userRows: UserRow[]
): Array<{ character_slug: string; male: Record<string, number>; female: Record<string, number>; both: Record<string, number>; private: Record<string, number>; total: Record<string, number> }> {
  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const bands = ["10s", "20s", "30s", "40s", "50s", "60+"] as const;
  const byCharUser = new Map<string, Set<string>>();
  for (const r of chatRows) {
    const key = `${r.character_slug}:${r.user_id}`;
    if (!byCharUser.has(r.character_slug)) byCharUser.set(r.character_slug, new Set());
    byCharUser.get(r.character_slug)!.add(r.user_id);
  }
  const result: Array<{
    character_slug: string;
    male: Record<string, number>;
    female: Record<string, number>;
    both: Record<string, number>;
    private: Record<string, number>;
    total: Record<string, number>;
  }> = [];
  byCharUser.forEach((userIds, character_slug) => {
    const male: Record<string, number> = {};
    const female: Record<string, number> = {};
    const bothBand: Record<string, number> = {};
    const privateBand: Record<string, number> = {};
    const total: Record<string, number> = {};
    bands.forEach((b) => {
      male[b] = 0;
      female[b] = 0;
      bothBand[b] = 0;
      privateBand[b] = 0;
      total[b] = 0;
    });
    userIds.forEach((uid) => {
      const u = userMap.get(uid);
      const band = ageBand(u?.birth_yyyymmdd ?? null);
      const g = normGender(u?.gender ?? null);
      if (!band) return;
      if (g === "male") male[band]++;
      else if (g === "female") female[band]++;
      else if (g === "both") bothBand[band]++;
      else privateBand[band]++;
      total[band]++;
    });
    result.push({ character_slug, male, female, both: bothBand, private: privateBand, total });
  });
  return result.sort((a, b) => a.character_slug.localeCompare(b.character_slug));
}

function computeAirportStepRatios(
  rows: Array<AirportRow & { gender: string | null }>
): {
  purpose: Record<string, Record<string, number>>;
  mood: Record<string, Record<string, number>>;
  character_type: Record<string, Record<string, number>>;
} {
  const purpose: Record<string, Record<string, number>> = { male: {}, female: {}, both: {}, private: {}, total: {} };
  const mood: Record<string, Record<string, number>> = { male: {}, female: {}, both: {}, private: {}, total: {} };
  const character_type: Record<string, Record<string, number>> = { male: {}, female: {}, both: {}, private: {}, total: {} };
  const inc = (
    map: Record<string, Record<string, number>>,
    g: string,
    key: string,
    val: string
  ) => {
    if (!val) return;
    if (!map[g]) map[g] = {};
    if (!map[g][val]) map[g][val] = 0;
    map[g][val]++;
    if (!map.total[val]) map.total[val] = 0;
    map.total[val]++;
  };
  rows.forEach((r) => {
    const g = normGender(r.gender);
    inc(purpose, g, "purpose", r.purpose);
    inc(mood, g, "mood", r.mood);
    inc(character_type, g, "character_type", r.character_type);
  });
  const toRatio = (map: Record<string, number>) => {
    const sum = Object.values(map).reduce((a, b) => a + b, 0);
    if (!sum) return map;
    const out: Record<string, number> = {};
    Object.keys(map).forEach((k) => (out[k] = map[k] / sum));
    return out;
  };
  ["male", "female", "both", "private", "total"].forEach((g) => {
    purpose[g] = toRatio(purpose[g] || {});
    mood[g] = toRatio(mood[g] || {});
    character_type[g] = toRatio(character_type[g] || {});
  });
  return { purpose, mood, character_type };
}
