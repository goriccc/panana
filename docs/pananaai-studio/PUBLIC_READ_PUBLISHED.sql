-- PananaAI Studio: App(anon/authenticated) 공개 읽기 정책 (published만)
-- 목적: 채팅 API/프론트에서 Studio 저작 데이터를 읽을 수 있게 하되,
--       "배포(published)" 된 캐릭터만 읽기 허용
--
-- 전제:
-- - docs/pananaai-studio/SCHEMA.sql 실행 완료
-- - docs/pananaai-studio/RLS.sql 실행 완료(관리자 all 정책)
--
-- NOTE:
-- - write는 여전히 admin-only
-- - 읽기 정책은 최소 컬럼에 대해서만(여기서는 select 전체 허용이지만 published로 제한)

-- characters: published만 SELECT 허용
drop policy if exists studio_characters_public_select_published on public.characters;
create policy studio_characters_public_select_published
on public.characters
for select
using (status = 'published');

-- character_prompts: published 캐릭터에 대해서만 SELECT 허용
drop policy if exists studio_prompts_public_select_published on public.character_prompts;
create policy studio_prompts_public_select_published
on public.character_prompts
for select
using (exists (select 1 from public.characters c where c.id = character_prompts.character_id and c.status = 'published'));

-- lorebook_entries: published 캐릭터/프로젝트 범위 중 character scope만 우선 공개(초기)
drop policy if exists studio_lorebook_public_select_published_character on public.lorebook_entries;
create policy studio_lorebook_public_select_published_character
on public.lorebook_entries
for select
using (
  scope = 'character'
  and exists (select 1 from public.characters c where c.id = lorebook_entries.character_id and c.status = 'published')
);

-- trigger_rule_sets: published 캐릭터의 character scope만 공개(초기)
drop policy if exists studio_triggers_public_select_published_character on public.trigger_rule_sets;
create policy studio_triggers_public_select_published_character
on public.trigger_rule_sets
for select
using (
  scope = 'character'
  and exists (select 1 from public.characters c where c.id = trigger_rule_sets.character_id and c.status = 'published')
);

-- 권한
grant select on public.characters to anon, authenticated;
grant select on public.character_prompts to anon, authenticated;
grant select on public.lorebook_entries to anon, authenticated;
grant select on public.trigger_rule_sets to anon, authenticated;

