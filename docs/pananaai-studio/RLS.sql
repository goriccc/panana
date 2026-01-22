-- PananaAI Studio RLS (admin allowlist 기반, 초기 운영용)
-- 목적:
-- - Studio 저작 테이블(projects/characters/...)은 기본적으로 admin-only
-- - 추후 project_members 기반 RBAC로 확장 가능
--
-- 전제:
-- - public.panana_admin_users 테이블이 존재하고,
--   RLS_FIX_ADMIN_USERS.sql 적용되어 (user_id = auth.uid()) 방식으로 select 가능해야 함
--
-- ⚠️중요: 이 파일은 "RLS만" 설정합니다.
-- 먼저 `docs/pananaai-studio/SCHEMA.sql`을 실행해서 public.projects 등 테이블을 생성한 뒤,
-- 그 다음에 이 RLS.sql을 실행해야 합니다.

-- Helper: allowlist check (policy 내 중복을 줄이고 싶으면 SECURITY DEFINER 함수로 분리 가능)

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.characters enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_participants enable row level security;
alter table public.lorebook_entries enable row level security;
alter table public.trigger_rule_sets enable row level security;
alter table public.character_prompts enable row level security;
alter table public.revisions enable row level security;

-- projects
drop policy if exists studio_projects_admin_all on public.projects;
create policy studio_projects_admin_all
on public.projects
for all
using (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true))
with check (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true));

-- project_members (현재는 admin-only)
drop policy if exists studio_project_members_admin_all on public.project_members;
create policy studio_project_members_admin_all
on public.project_members
for all
using (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true))
with check (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true));

-- characters
drop policy if exists studio_characters_admin_all on public.characters;
create policy studio_characters_admin_all
on public.characters
for all
using (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true))
with check (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true));

-- scenes
drop policy if exists studio_scenes_admin_all on public.scenes;
create policy studio_scenes_admin_all
on public.scenes
for all
using (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true))
with check (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true));

-- scene_participants
drop policy if exists studio_scene_participants_admin_all on public.scene_participants;
create policy studio_scene_participants_admin_all
on public.scene_participants
for all
using (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true))
with check (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true));

-- lorebook_entries
drop policy if exists studio_lorebook_admin_all on public.lorebook_entries;
create policy studio_lorebook_admin_all
on public.lorebook_entries
for all
using (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true))
with check (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true));

-- trigger_rule_sets
drop policy if exists studio_triggers_admin_all on public.trigger_rule_sets;
create policy studio_triggers_admin_all
on public.trigger_rule_sets
for all
using (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true))
with check (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true));

-- character_prompts
drop policy if exists studio_prompts_admin_all on public.character_prompts;
create policy studio_prompts_admin_all
on public.character_prompts
for all
using (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true))
with check (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true));

-- revisions
drop policy if exists studio_revisions_admin_all on public.revisions;
create policy studio_revisions_admin_all
on public.revisions
for all
using (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true))
with check (exists (select 1 from public.panana_admin_users au where au.user_id = auth.uid() and au.active = true));

-- 권한(기본)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

