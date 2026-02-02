import { getBrowserSupabase } from "@/lib/supabase/browser";
import type { StudioPromptState, PromptLorebookItem, TriggerCondition, TriggerRulesPayload } from "@/lib/studio/types";

export type StudioProjectRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type StudioSceneRow = {
  id: string;
  project_id: string;
  slug: string;
  episode_label: string;
  title: string;
  group_chat_enabled: boolean;
  status: "draft" | "review" | "approved" | "published" | "archived";
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type StudioCharacterRow = {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  handle: string;
  hashtags: string[];
  tagline: string;
  intro_title: string;
  intro_lines: string[];
  mood_title: string;
  mood_lines: string[];
  role_label: string;
  status: "draft" | "review" | "approved" | "published" | "archived";
  created_by: string;
  created_at: string;
  updated_at: string;
};

async function mustUserId() {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("Not signed in");
  return uid;
}

export async function studioListProjects(): Promise<StudioProjectRow[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.from("projects").select("id, slug, title, subtitle, created_by, created_at, updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function studioGetProject(projectId: string): Promise<StudioProjectRow | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, title, subtitle, created_by, created_at, updated_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function studioDeleteProject(args: { projectId: string }) {
  const supabase = getBrowserSupabase();
  await mustUserId(); // auth guard + RLS evaluation context
  const { error } = await supabase.from("projects").delete().eq("id", args.projectId);
  if (error) throw error;
}

export async function studioCreateProject(args: { slug: string; title: string; subtitle?: string }) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();
  const { data, error } = await supabase
    .from("projects")
    .insert({ slug: args.slug, title: args.title, subtitle: args.subtitle || null, created_by: userId })
    .select("id, slug, title, subtitle, created_by, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as any as StudioProjectRow;
}

export async function studioListCharacters(args?: { projectId?: string }): Promise<StudioCharacterRow[]> {
  const supabase = getBrowserSupabase();
  let q = supabase
    .from("characters")
    .select(
      "id, project_id, slug, name, handle, hashtags, tagline, intro_title, intro_lines, mood_title, mood_lines, role_label, status, created_by, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });
  if (args?.projectId) q = q.eq("project_id", args.projectId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as any;
}

/** character_id → nsfwFilterOff (오서노트 NSFW 필터 해제 여부) */
export async function studioGetCharactersNsfwMap(characterIds: string[]): Promise<Record<string, boolean>> {
  if (!characterIds.length) return {};
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("character_prompts")
    .select("character_id, payload")
    .in("character_id", characterIds);
  if (error) return {};
  const map: Record<string, boolean> = {};
  for (const row of data || []) {
    const author = (row as any)?.payload?.author;
    map[String((row as any).character_id)] = Boolean(author?.nsfwFilterOff);
  }
  return map;
}

export async function studioListScenes(args: { projectId: string }): Promise<StudioSceneRow[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("scenes")
    .select("id, project_id, slug, episode_label, title, group_chat_enabled, status, created_by, created_at, updated_at")
    .eq("project_id", args.projectId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function studioGetScene(args: { projectId: string; sceneId: string }): Promise<StudioSceneRow | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("scenes")
    .select("id, project_id, slug, episode_label, title, group_chat_enabled, status, created_by, created_at, updated_at")
    .eq("project_id", args.projectId)
    .eq("id", args.sceneId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function studioCreateScene(args: { projectId: string; slug: string; title: string; episodeLabel?: string; groupChatEnabled?: boolean }) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();
  const { data, error } = await supabase
    .from("scenes")
    .insert({
      project_id: args.projectId,
      slug: args.slug,
      title: args.title,
      episode_label: args.episodeLabel || "",
      group_chat_enabled: args.groupChatEnabled ?? true,
      created_by: userId,
    })
    .select("id, project_id, slug, episode_label, title, group_chat_enabled, status, created_by, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as any as StudioSceneRow;
}

export async function studioEnsureProjectScenes(args: {
  projectId: string;
  scenes: Array<{ slug: string; title: string; episodeLabel: string; groupChatEnabled?: boolean }>;
}) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();

  const existing = await studioListScenes({ projectId: args.projectId });
  const existingSlugs = new Set(existing.map((s) => String(s.slug || "").toLowerCase()).filter(Boolean));

  const toCreate = (args.scenes || []).filter((s) => {
    const slug = String(s.slug || "").toLowerCase();
    return slug && !existingSlugs.has(slug);
  });
  if (!toCreate.length) return;

  const payload = toCreate.map((s) => ({
    project_id: args.projectId,
    slug: s.slug,
    episode_label: s.episodeLabel || "",
    title: s.title,
    group_chat_enabled: s.groupChatEnabled ?? true,
    status: "draft",
    created_by: userId,
  }));

  const { error } = await supabase.from("scenes").insert(payload as any);
  if (error) throw error;
}

export async function studioEnsureProjectScenesFromImport(args: {
  projectId: string;
  scenes: Array<{
    slug: string;
    title: string;
    episodeLabel: string;
    groupChatEnabled?: boolean;
    seedLorebookValue?: string;
    seedRules?: any;
  }>;
  defaultParticipantIds?: string[];
}) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();

  const existing = await studioListScenes({ projectId: args.projectId });
  const existingSlugs = new Set(existing.map((s) => String(s.slug || "").toLowerCase()).filter(Boolean));

  const toCreate = (args.scenes || []).filter((s) => {
    const slug = String(s.slug || "").toLowerCase();
    return slug && !existingSlugs.has(slug);
  });

  if (toCreate.length) {
    const payload = toCreate.map((s) => ({
      project_id: args.projectId,
      slug: s.slug,
      episode_label: s.episodeLabel || "",
      title: s.title,
      group_chat_enabled: s.groupChatEnabled ?? true,
      status: "draft",
      created_by: userId,
    }));
    const { error } = await supabase.from("scenes").insert(payload as any);
    if (error) throw error;
  }

  // 씬 요약 seed 로어북(신규 생성된 씬에만, 그리고 씬 로어북이 비어있을 때만)
  const all = await studioListScenes({ projectId: args.projectId });
  const bySlug = new Map(all.map((s) => [String(s.slug || "").toLowerCase(), s] as const));
  for (const s of toCreate) {
    const row = bySlug.get(String(s.slug || "").toLowerCase());
    if (!row?.id) continue;
    const seed = String(s.seedLorebookValue || "").trim();
    if (!seed) continue;

    const { count, error: cntErr } = await supabase
      .from("lorebook_entries")
      .select("id", { count: "exact", head: true })
      .eq("project_id", args.projectId)
      .eq("scope", "scene")
      .eq("scene_id", row.id);
    if (cntErr) throw cntErr;
    if ((count || 0) > 0) continue;

    const { error: insErr } = await supabase.from("lorebook_entries").insert({
      project_id: args.projectId,
      scope: "scene",
      scene_id: row.id,
      key: "씬 요약",
      value: seed,
      merge_mode: "override",
      unlock_type: "public",
      sort_order: 0,
      active: true,
      created_by: userId,
    } as any);
    if (insErr) throw insErr;
  }

  // 씬 룰 seed (신규 생성된 씬에만, 그리고 씬 룰이 비어있을 때만)
  for (const s of toCreate) {
    const row = bySlug.get(String(s.slug || "").toLowerCase());
    if (!row?.id) continue;
    const seedRules = (s as any).seedRules;
    if (!seedRules || !Array.isArray(seedRules.rules) || !seedRules.rules.length) continue;

    const { count, error: cntErr } = await supabase
      .from("trigger_rule_sets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", args.projectId)
      .eq("scope", "scene")
      .eq("scene_id", row.id);
    if (cntErr) throw cntErr;
    if ((count || 0) > 0) continue;

    const { error: insErr } = await supabase.from("trigger_rule_sets").insert({
      project_id: args.projectId,
      scope: "scene",
      scene_id: row.id,
      status: "draft",
      payload: seedRules,
      created_by: userId,
    } as any);
    if (insErr) throw insErr;
  }

  // 씬 기본 참여자 seed (신규 생성된 씬에만, 그리고 참여자가 비어있을 때만)
  const defaults = (args.defaultParticipantIds || []).filter(Boolean);
  if (defaults.length) {
    for (const s of toCreate) {
      const row = bySlug.get(String(s.slug || "").toLowerCase());
      if (!row?.id) continue;

      const { count, error: cntErr } = await supabase
        .from("scene_participants")
        .select("character_id", { count: "exact", head: true })
        .eq("scene_id", row.id);
      if (cntErr) throw cntErr;
      if ((count || 0) > 0) continue;

      const payload = defaults.map((id, idx) => ({ scene_id: row.id, character_id: id, sort_order: idx }));
      const { error } = await supabase.from("scene_participants").insert(payload as any);
      if (error) throw error;
    }
  }
}

export async function studioUpdateSceneGroupChatEnabled(args: { projectId: string; sceneId: string; groupChatEnabled: boolean }) {
  const supabase = getBrowserSupabase();
  await mustUserId();
  const { error } = await supabase
    .from("scenes")
    .update({ group_chat_enabled: args.groupChatEnabled })
    .eq("project_id", args.projectId)
    .eq("id", args.sceneId);
  if (error) throw error;
}

export async function studioLoadSceneParticipants(args: { sceneId: string }): Promise<string[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("scene_participants")
    .select("character_id, sort_order")
    .eq("scene_id", args.sceneId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => String(r.character_id)).filter(Boolean);
}

export async function studioSaveSceneParticipants(args: { sceneId: string; participantIds: string[] }) {
  const supabase = getBrowserSupabase();
  await mustUserId();

  const { error: delErr } = await supabase.from("scene_participants").delete().eq("scene_id", args.sceneId);
  if (delErr) throw delErr;
  const ids = (args.participantIds || []).filter(Boolean);
  if (!ids.length) return;

  const payload = ids.map((id, idx) => ({ scene_id: args.sceneId, character_id: id, sort_order: idx }));
  const { error } = await supabase.from("scene_participants").insert(payload as any);
  if (error) throw error;
}

export async function studioLoadSceneLorebook(args: { projectId: string; sceneId: string }): Promise<PromptLorebookItem[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("lorebook_entries")
    .select(
      "id, key, value, merge_mode, unlock_type, unlock_affection_min, unlock_expr, unlock_cost_panana, unlock_ending_key, unlock_ep_min, unlock_sku, sort_order"
    )
    .eq("project_id", args.projectId)
    .eq("scope", "scene")
    .eq("scene_id", args.sceneId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => {
    const t = r.unlock_type as "public" | "affection" | "paid_item" | "condition" | "ending_route";
    const unlock =
      t === "affection"
        ? ({ type: "affection", min: Number(r.unlock_affection_min) || 0 } as const)
        : t === "paid_item"
          ? ({ type: "paid_item", sku: String(r.unlock_sku || "") } as const)
          : t === "condition"
            ? ({
                type: "condition",
                expr: String(r.unlock_expr || ""),
                costPanana: r.unlock_cost_panana == null ? undefined : Number(r.unlock_cost_panana) || 0,
              } as const)
            : t === "ending_route"
              ? ({
                  type: "ending_route",
                  endingKey: r.unlock_ending_key == null ? undefined : String(r.unlock_ending_key || "").trim() || undefined,
                  epMin: r.unlock_ep_min == null ? undefined : Number(r.unlock_ep_min) || 0,
                  costPanana: r.unlock_cost_panana == null ? undefined : Number(r.unlock_cost_panana) || 0,
                } as const)
              : ({ type: "public" } as const);
    const mergeMode = (String(r.merge_mode || "override") as any) === "append" ? "append" : "override";
    return { id: String(r.id), key: String(r.key), value: String(r.value), mergeMode, unlock };
  });
}

export async function studioSaveSceneLorebook(args: { projectId: string; sceneId: string; rows: PromptLorebookItem[] }) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();

  const { error: delErr } = await supabase
    .from("lorebook_entries")
    .delete()
    .eq("project_id", args.projectId)
    .eq("scope", "scene")
    .eq("scene_id", args.sceneId);
  if (delErr) throw delErr;
  if (!args.rows.length) return;

  const payload = args.rows.map((r, idx) => {
    const unlock_type = r.unlock.type;
    const merge_mode = (r as any).mergeMode === "append" ? "append" : "override";
    return {
      project_id: args.projectId,
      scope: "scene",
      scene_id: args.sceneId,
      key: r.key,
      value: r.value,
      merge_mode,
      unlock_type,
      unlock_affection_min: unlock_type === "affection" ? r.unlock.min : null,
      unlock_expr: unlock_type === "condition" ? (r.unlock as any).expr : null,
      unlock_cost_panana:
        unlock_type === "condition" || unlock_type === "ending_route" ? ((r.unlock as any).costPanana ?? null) : null,
      unlock_ending_key: unlock_type === "ending_route" ? ((r.unlock as any).endingKey ?? null) : null,
      unlock_ep_min: unlock_type === "ending_route" ? ((r.unlock as any).epMin ?? null) : null,
      unlock_sku: unlock_type === "paid_item" ? (r.unlock as any).sku : null,
      sort_order: idx,
      active: true,
      created_by: userId,
    };
  });
  const { error: insErr } = await supabase.from("lorebook_entries").insert(payload as any);
  if (insErr) throw insErr;
}

export async function studioLoadSceneRules(args: { projectId: string; sceneId: string }): Promise<TriggerRulesPayload | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("trigger_rule_sets")
    .select("id, payload")
    .eq("project_id", args.projectId)
    .eq("scope", "scene")
    .eq("scene_id", args.sceneId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.payload as any) || null;
}

export async function studioSaveSceneRules(args: { projectId: string; sceneId: string; payload: TriggerRulesPayload }) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();

  const { data: existing, error: selErr } = await supabase
    .from("trigger_rule_sets")
    .select("id")
    .eq("project_id", args.projectId)
    .eq("scope", "scene")
    .eq("scene_id", args.sceneId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing?.id) {
    const { error } = await supabase.from("trigger_rule_sets").update({ payload: args.payload as any }).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("trigger_rule_sets").insert({
    project_id: args.projectId,
    scope: "scene",
    scene_id: args.sceneId,
    status: "draft",
    payload: args.payload as any,
    created_by: userId,
  } as any);
  if (error) throw error;
}

export async function studioCreateCharacter(args: {
  projectId: string;
  slug: string;
  name: string;
  roleLabel?: string;
  handle?: string;
  hashtags?: string[];
  tagline?: string;
  introTitle?: string;
  introLines?: string[];
  moodTitle?: string;
  moodLines?: string[];
}) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();
  const { data, error } = await supabase
    .from("characters")
    .insert({
      project_id: args.projectId,
      slug: args.slug,
      name: args.name,
      handle: args.handle || "",
      hashtags: Array.isArray(args.hashtags) ? args.hashtags : [],
      tagline: args.tagline || "",
      intro_title: args.introTitle || "",
      intro_lines: Array.isArray(args.introLines) ? args.introLines : [],
      mood_title: args.moodTitle || "",
      mood_lines: Array.isArray(args.moodLines) ? args.moodLines : [],
      role_label: args.roleLabel || "",
      created_by: userId,
    })
    .select(
      "id, project_id, slug, name, handle, hashtags, tagline, intro_title, intro_lines, mood_title, mood_lines, role_label, status, created_by, created_at, updated_at"
    )
    .single();
  if (error) throw error;
  return data as any as StudioCharacterRow;
}

export async function studioPublishCharacter(characterId: string) {
  const supabase = getBrowserSupabase();

  const c = await studioGetCharacter(characterId);
  if (!c) throw new Error("Character not found");

  // 1) 캐릭터 published
  const { error: cErr } = await supabase
    .from("characters")
    .update({ status: "published" })
    .eq("id", characterId);
  if (cErr) throw cErr;

  // 2) 프롬프트 published (없어도 캐릭터 배포는 유지)
  try {
    const { error } = await supabase.from("character_prompts").update({ status: "published" }).eq("character_id", characterId);
    if (error) throw error;
  } catch {
    // ignore (프롬프트가 없어도 배포는 진행)
  }

  // 3) 트리거 published (character scope 전부)
  try {
    const { error } = await supabase
      .from("trigger_rule_sets")
      .update({ status: "published" })
      .eq("project_id", c.project_id)
      .eq("scope", "character")
      .eq("character_id", characterId);
    if (error) throw error;
  } catch {
    // ignore (트리거가 없어도 배포는 진행)
  }
}

export async function studioUnpublishCharacter(characterId: string) {
  const supabase = getBrowserSupabase();

  const c = await studioGetCharacter(characterId);
  if (!c) throw new Error("Character not found");

  // 1) 캐릭터 draft로 되돌림(앱/채팅 노출 중지)
  const { error: cErr } = await supabase
    .from("characters")
    .update({ status: "draft" })
    .eq("id", characterId);
  if (cErr) throw cErr;

  // 2) 프롬프트도 draft로 되돌림(있으면)
  try {
    const { error } = await supabase.from("character_prompts").update({ status: "draft" }).eq("character_id", characterId);
    if (error) throw error;
  } catch {
    // ignore
  }

  // 3) 트리거도 draft로 되돌림(character scope 전부, 있으면)
  try {
    const { error } = await supabase
      .from("trigger_rule_sets")
      .update({ status: "draft" })
      .eq("project_id", c.project_id)
      .eq("scope", "character")
      .eq("character_id", characterId);
    if (error) throw error;
  } catch {
    // ignore
  }
}

export async function studioDeleteCharacter(characterId: string) {
  const supabase = getBrowserSupabase();
  await mustUserId(); // auth guard + RLS evaluation context

  const c = await studioGetCharacter(characterId);
  if (!c) return;

  // 연관 데이터 정리(있으면). DB에 FK cascade가 있더라도, 안정적으로 먼저 제거.
  const { error: pErr } = await supabase.from("character_prompts").delete().eq("character_id", characterId);
  if (pErr) throw pErr;

  const { error: lErr } = await supabase
    .from("lorebook_entries")
    .delete()
    .eq("project_id", c.project_id)
    .eq("scope", "character")
    .eq("character_id", characterId);
  if (lErr) throw lErr;

  const { error: tErr } = await supabase
    .from("trigger_rule_sets")
    .delete()
    .eq("project_id", c.project_id)
    .eq("scope", "character")
    .eq("character_id", characterId);
  if (tErr) throw tErr;

  const { error: cErr } = await supabase.from("characters").delete().eq("id", characterId);
  if (cErr) throw cErr;
}

export async function studioGetCharacter(characterId: string): Promise<StudioCharacterRow | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("characters")
    .select(
      "id, project_id, slug, name, handle, hashtags, tagline, intro_title, intro_lines, mood_title, mood_lines, role_label, status, created_by, created_at, updated_at"
    )
    .eq("id", characterId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) || null;
}

export async function studioUpdateCharacterPublicProfile(args: {
  characterId: string;
  patch: Partial<{
    name: string;
    handle: string;
    hashtags: string[];
    tagline: string;
    intro_title: string;
    intro_lines: string[];
    mood_title: string;
    mood_lines: string[];
  }>;
}) {
  const supabase = getBrowserSupabase();
  await mustUserId(); // auth guard + RLS evaluation context
  const { error } = await supabase.from("characters").update(args.patch as any).eq("id", args.characterId);
  if (error) throw error;
}

export async function studioUpdateCharacterRoleLabel(args: { characterId: string; roleLabel: string }) {
  const supabase = getBrowserSupabase();
  await mustUserId(); // auth guard + RLS evaluation context
  const { error } = await supabase.from("characters").update({ role_label: args.roleLabel }).eq("id", args.characterId);
  if (error) throw error;
}

export async function studioLoadPromptPayload(characterId: string): Promise<{ payload: Partial<StudioPromptState> | null }> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.from("character_prompts").select("payload").eq("character_id", characterId).maybeSingle();
  if (error) throw error;
  return { payload: (data?.payload as any) || null };
}

export async function studioSavePromptPayload(args: {
  projectId: string;
  characterId: string;
  payload: Partial<StudioPromptState>;
  status?: "draft" | "review" | "approved" | "published" | "archived";
}) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();
  const { error } = await supabase
    .from("character_prompts")
    .upsert(
      {
        project_id: args.projectId,
        character_id: args.characterId,
        payload: args.payload as any,
        status: args.status || "draft",
        created_by: userId,
      },
      { onConflict: "character_id" }
    );
  if (error) throw error;
}

export async function studioLoadLorebook(characterId: string): Promise<PromptLorebookItem[]> {
  const supabase = getBrowserSupabase();
  const c = await studioGetCharacter(characterId);
  if (!c) return [];
  const { data, error } = await supabase
    .from("lorebook_entries")
    .select(
      "id, key, value, merge_mode, unlock_type, unlock_affection_min, unlock_expr, unlock_cost_panana, unlock_ending_key, unlock_ep_min, unlock_sku, sort_order"
    )
    .eq("project_id", c.project_id)
    .eq("scope", "character")
    .eq("character_id", characterId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map((r: any) => {
    const t = r.unlock_type as "public" | "affection" | "paid_item" | "condition" | "ending_route";
    const unlock =
      t === "affection"
        ? ({ type: "affection", min: Number(r.unlock_affection_min) || 0 } as const)
        : t === "paid_item"
          ? ({ type: "paid_item", sku: String(r.unlock_sku || "") } as const)
          : t === "condition"
            ? ({
                type: "condition",
                expr: String(r.unlock_expr || ""),
                costPanana: r.unlock_cost_panana == null ? undefined : Number(r.unlock_cost_panana) || 0,
              } as const)
            : t === "ending_route"
              ? ({
                  type: "ending_route",
                  endingKey: r.unlock_ending_key == null ? undefined : String(r.unlock_ending_key || "").trim() || undefined,
                  epMin: r.unlock_ep_min == null ? undefined : Number(r.unlock_ep_min) || 0,
                  costPanana: r.unlock_cost_panana == null ? undefined : Number(r.unlock_cost_panana) || 0,
                } as const)
            : ({ type: "public" } as const);
    const mergeMode = (String(r.merge_mode || "override") as any) === "append" ? "append" : "override";
    return { id: String(r.id), key: String(r.key), value: String(r.value), mergeMode, unlock };
  });
}

export async function studioLoadProjectLorebook(projectId: string): Promise<PromptLorebookItem[]> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("lorebook_entries")
    .select(
      "id, key, value, merge_mode, unlock_type, unlock_affection_min, unlock_expr, unlock_cost_panana, unlock_ending_key, unlock_ep_min, unlock_sku, sort_order"
    )
    .eq("project_id", projectId)
    .eq("scope", "project")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  return (data || []).map((r: any) => {
    const t = r.unlock_type as "public" | "affection" | "paid_item" | "condition" | "ending_route";
    const unlock =
      t === "affection"
        ? ({ type: "affection", min: Number(r.unlock_affection_min) || 0 } as const)
        : t === "paid_item"
          ? ({ type: "paid_item", sku: String(r.unlock_sku || "") } as const)
          : t === "condition"
            ? ({
                type: "condition",
                expr: String(r.unlock_expr || ""),
                costPanana: r.unlock_cost_panana == null ? undefined : Number(r.unlock_cost_panana) || 0,
              } as const)
            : t === "ending_route"
              ? ({
                  type: "ending_route",
                  endingKey: r.unlock_ending_key == null ? undefined : String(r.unlock_ending_key || "").trim() || undefined,
                  epMin: r.unlock_ep_min == null ? undefined : Number(r.unlock_ep_min) || 0,
                  costPanana: r.unlock_cost_panana == null ? undefined : Number(r.unlock_cost_panana) || 0,
                } as const)
              : ({ type: "public" } as const);
    const mergeMode = (String(r.merge_mode || "override") as any) === "append" ? "append" : "override";
    return { id: String(r.id), key: String(r.key), value: String(r.value), mergeMode, unlock };
  });
}

export async function studioSaveLorebook(characterId: string, rows: PromptLorebookItem[]) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();
  const c = await studioGetCharacter(characterId);
  if (!c) throw new Error("Character not found");

  // 단순/안전: 전체 교체(삭제 후 재삽입)
  const { error: delErr } = await supabase
    .from("lorebook_entries")
    .delete()
    .eq("project_id", c.project_id)
    .eq("scope", "character")
    .eq("character_id", characterId);
  if (delErr) throw delErr;

  if (!rows.length) return;

  const payload = rows.map((r, idx) => {
    const unlock_type = r.unlock.type;
    const merge_mode = (r as any).mergeMode === "append" ? "append" : "override";
    return {
      project_id: c.project_id,
      scope: "character",
      character_id: characterId,
      key: r.key,
      value: r.value,
      merge_mode,
      unlock_type,
      unlock_affection_min: unlock_type === "affection" ? r.unlock.min : null,
      unlock_expr: unlock_type === "condition" ? (r.unlock as any).expr : null,
      unlock_cost_panana:
        unlock_type === "condition" || unlock_type === "ending_route" ? ((r.unlock as any).costPanana ?? null) : null,
      unlock_ending_key: unlock_type === "ending_route" ? ((r.unlock as any).endingKey ?? null) : null,
      unlock_ep_min: unlock_type === "ending_route" ? ((r.unlock as any).epMin ?? null) : null,
      unlock_sku: unlock_type === "paid_item" ? (r.unlock as any).sku : null,
      sort_order: idx,
      active: true,
      created_by: userId,
    };
  });

  const { error: insErr } = await supabase.from("lorebook_entries").insert(payload as any);
  if (insErr) throw insErr;
}

export async function studioSaveProjectLorebook(projectId: string, rows: PromptLorebookItem[]) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();

  const { error: delErr } = await supabase.from("lorebook_entries").delete().eq("project_id", projectId).eq("scope", "project");
  if (delErr) throw delErr;

  if (!rows.length) return;

  const payload = rows.map((r, idx) => {
    const unlock_type = r.unlock.type;
    const merge_mode = (r as any).mergeMode === "append" ? "append" : "override";
    return {
      project_id: projectId,
      scope: "project",
      key: r.key,
      value: r.value,
      merge_mode,
      unlock_type,
      unlock_affection_min: unlock_type === "affection" ? r.unlock.min : null,
      unlock_expr: unlock_type === "condition" ? (r.unlock as any).expr : null,
      unlock_cost_panana:
        unlock_type === "condition" || unlock_type === "ending_route" ? ((r.unlock as any).costPanana ?? null) : null,
      unlock_ending_key: unlock_type === "ending_route" ? ((r.unlock as any).endingKey ?? null) : null,
      unlock_ep_min: unlock_type === "ending_route" ? ((r.unlock as any).epMin ?? null) : null,
      unlock_sku: unlock_type === "paid_item" ? (r.unlock as any).sku : null,
      sort_order: idx,
      active: true,
      created_by: userId,
    };
  });

  const { error: insErr } = await supabase.from("lorebook_entries").insert(payload as any);
  if (insErr) throw insErr;
}

export async function studioLoadTriggers(characterId: string): Promise<TriggerRulesPayload | null> {
  const supabase = getBrowserSupabase();
  const c = await studioGetCharacter(characterId);
  if (!c) return null;
  const { data, error } = await supabase
    .from("trigger_rule_sets")
    .select("id, payload")
    .eq("project_id", c.project_id)
    .eq("scope", "character")
    .eq("character_id", characterId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.payload as any) || null;
}

export async function studioLoadProjectRules(projectId: string): Promise<TriggerRulesPayload | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("trigger_rule_sets")
    .select("id, payload")
    .eq("project_id", projectId)
    .eq("scope", "project")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.payload as any) || null;
}

export async function studioSaveTriggers(characterId: string, payload: TriggerRulesPayload) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();
  const c = await studioGetCharacter(characterId);
  if (!c) throw new Error("Character not found");

  const { data: existing, error: selErr } = await supabase
    .from("trigger_rule_sets")
    .select("id")
    .eq("project_id", c.project_id)
    .eq("scope", "character")
    .eq("character_id", characterId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing?.id) {
    const { error } = await supabase.from("trigger_rule_sets").update({ payload: payload as any }).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("trigger_rule_sets").insert({
    project_id: c.project_id,
    scope: "character",
    character_id: characterId,
    status: "draft",
    payload: payload as any,
    created_by: userId,
  } as any);
  if (error) throw error;
}

export async function studioSaveProjectRules(projectId: string, payload: TriggerRulesPayload) {
  const supabase = getBrowserSupabase();
  const userId = await mustUserId();

  const { data: existing, error: selErr } = await supabase
    .from("trigger_rule_sets")
    .select("id")
    .eq("project_id", projectId)
    .eq("scope", "project")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;

  if (existing?.id) {
    const { error } = await supabase.from("trigger_rule_sets").update({ payload: payload as any }).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("trigger_rule_sets").insert({
    project_id: projectId,
    scope: "project",
    status: "draft",
    payload: payload as any,
    created_by: userId,
  } as any);
  if (error) throw error;
}

function upgradeInlineConditionToken(token: string): TriggerCondition | null {
  const raw = String(token || "").trim();
  if (!raw) return null;
  const mVar = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*(<=|>=|=|==|<|>)\s*([0-9]{1,12})$/.exec(raw);
  if (mVar) {
    const varName = String(mVar[1] || "").trim();
    const opRaw = String(mVar[2] || "");
    const op = (opRaw === "==" ? "=" : opRaw) as any;
    return { type: "variable_compare", var: varName, op, value: Number(mVar[3]) || 0 } as TriggerCondition;
  }
  const mParticipant = /^(participant_present|participant|참여자|참석자)\s*[:=]\s*(.+)$/i.exec(raw);
  if (mParticipant) {
    const name = String(mParticipant[2] || "").trim();
    if (!name) return null;
    return { type: "participant_present", name } as TriggerCondition;
  }
  const mStr = /^(location|time|위치|시간)\s*(==|=|!=)\s*(.+)$/i.exec(raw);
  if (mStr) {
    const keyRaw = String(mStr[1] || "").trim().toLowerCase();
    const varName = keyRaw === "위치" ? "location" : keyRaw === "시간" ? "time" : keyRaw;
    const opRaw = String(mStr[2] || "");
    const op = (opRaw === "!=" ? "!=" : "=") as any;
    const value = String(mStr[3] || "").trim();
    if (!value) return null;
    return { type: "string_compare", var: varName, op, value } as TriggerCondition;
  }
  return null;
}

function extractLegacyJoinLeave(textRaw: string) {
  const text = String(textRaw || "");
  const out: { joins: string[]; leaves: string[] } = { joins: [], leaves: [] };
  const directive = (kind: "join" | "leave") => {
    const re = new RegExp(`(?:^|[;\\n])\\s*${kind}\\s*:\\s*([^;\\n]+)`, "i");
    const m = re.exec(text);
    if (m?.[1]) out[kind === "join" ? "joins" : "leaves"].push(String(m[1]).trim());
  };
  directive("join");
  directive("leave");

  const legacy = (kind: "join" | "leave") => {
    const key = kind === "join" ? "[JOIN 이벤트]" : "[LEAVE 이벤트]";
    if (!text.includes(key)) return;
    let rest = text.replace(key, "").trim();
    rest = rest.replace(/^\[[^\]]+\]\s*/, "");
    let name = rest.split(/[:\n]/)[0] || "";
    name = name.replace(/(등장|퇴장|난입|합류).*/g, "").trim();
    if (name) out[kind === "join" ? "joins" : "leaves"].push(name);
  };
  legacy("join");
  legacy("leave");

  out.joins = Array.from(new Set(out.joins.filter(Boolean)));
  out.leaves = Array.from(new Set(out.leaves.filter(Boolean)));
  return out;
}

function upgradeTriggerPayload(payload: TriggerRulesPayload) {
  if (!payload || !Array.isArray(payload.rules)) return { payload, changed: false };
  let changed = false;
  const nextRules = payload.rules.map((r) => {
    const next = { ...r };
    if (r?.if?.conditions && Array.isArray(r.if.conditions)) {
      const nextConds: TriggerCondition[] = [];
      for (const c of r.if.conditions as TriggerCondition[]) {
        if (c.type === "variable_compare" && (c as any).var === "danger") {
          nextConds.push({ ...(c as any), var: "risk" });
          changed = true;
          continue;
        }
        if (c.type === "text_includes" && Array.isArray(c.values) && c.values.length === 1) {
          const upgraded = upgradeInlineConditionToken(String(c.values[0] || ""));
          if (upgraded) {
            nextConds.push(upgraded);
            changed = true;
            continue;
          }
        }
        nextConds.push(c as any);
      }
      next.if = { ...r.if, conditions: nextConds };
    }

    if (r?.then?.actions && Array.isArray(r.then.actions)) {
      const actions = [...r.then.actions] as any[];
      const joinNames = new Set(actions.filter((a) => a?.type === "join").map((a) => String(a?.name || "").trim()).filter(Boolean));
      const leaveNames = new Set(actions.filter((a) => a?.type === "leave").map((a) => String(a?.name || "").trim()).filter(Boolean));
      const upgradedActions: any[] = [];
      for (const a of actions) {
        if (a?.type === "variable_mod" && String(a?.var || "") === "danger") {
          upgradedActions.push({ ...a, var: "risk" });
          changed = true;
          continue;
        }
        if (a?.type === "system_message") {
          const parsed = extractLegacyJoinLeave(String(a?.text || ""));
          for (const name of parsed.joins) {
            if (!joinNames.has(name)) {
              upgradedActions.push({ type: "join", name });
              joinNames.add(name);
              changed = true;
            }
          }
          for (const name of parsed.leaves) {
            if (!leaveNames.has(name)) {
              upgradedActions.push({ type: "leave", name });
              leaveNames.add(name);
              changed = true;
            }
          }
        }
        upgradedActions.push(a);
      }
      next.then = { ...r.then, actions: upgradedActions };
    }
    return next;
  });
  return { payload: { ...payload, rules: nextRules }, changed };
}

export async function studioUpgradeTriggerRules(args: { projectId: string }) {
  const supabase = getBrowserSupabase();
  await mustUserId();
  const projectId = String(args.projectId || "").trim();
  if (!projectId) throw new Error("Project id is required");

  const { data, error } = await supabase.from("trigger_rule_sets").select("id, scope, payload").eq("project_id", projectId);
  if (error) throw error;
  const rows = (data || []) as Array<{ id: string; scope: string; payload: any }>;
  let updated = 0;
  let changed = 0;

  for (const row of rows) {
    const payload = row?.payload as TriggerRulesPayload;
    if (!payload || !Array.isArray((payload as any)?.rules)) continue;
    const upgraded = upgradeTriggerPayload(payload);
    if (!upgraded.changed) continue;
    const { error: upErr } = await supabase.from("trigger_rule_sets").update({ payload: upgraded.payload as any }).eq("id", row.id);
    if (upErr) throw upErr;
    updated += 1;
    changed += 1;
  }

  return { scanned: rows.length, updated, changed };
}

export async function studioUpgradeAllTriggerRules() {
  const supabase = getBrowserSupabase();
  await mustUserId();
  const { data, error } = await supabase.from("projects").select("id");
  if (error) throw error;
  const ids = (data || []).map((p: any) => String(p?.id || "")).filter(Boolean);
  let scanned = 0;
  let updated = 0;
  for (const id of ids) {
    const res = await studioUpgradeTriggerRules({ projectId: id });
    scanned += res.scanned;
    updated += res.updated;
  }
  return { projects: ids.length, scanned, updated };
}