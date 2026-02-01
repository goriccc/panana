-- Migration: Panana characters gender
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_characters
  add column if not exists gender text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'panana_characters_gender_check'
  ) then
    alter table public.panana_characters drop constraint panana_characters_gender_check;
  end if;
end $$;

alter table public.panana_characters
  add constraint panana_characters_gender_check
  check (gender is null or gender in ('female','male'));
