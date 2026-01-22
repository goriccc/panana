-- User Profiles (nickname, etc.)
-- 목적:
-- - 프론트(마이페이지)에서 닉네임을 DB에 저장
-- - 채팅 템플릿 변수 {{user_name}} 치환에 활용

create table if not exists public.panana_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists panana_user_profiles_nickname_idx
  on public.panana_user_profiles (nickname);

-- updated_at 자동 갱신 트리거
create or replace function public.panana_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists panana_user_profiles_touch_updated_at on public.panana_user_profiles;
create trigger panana_user_profiles_touch_updated_at
before update on public.panana_user_profiles
for each row execute function public.panana_touch_updated_at();

alter table public.panana_user_profiles enable row level security;

-- 본인 프로필만 읽기
drop policy if exists "user_profiles_select_own" on public.panana_user_profiles;
create policy "user_profiles_select_own"
on public.panana_user_profiles
for select
to authenticated
using (user_id = auth.uid());

-- 본인 프로필만 생성
drop policy if exists "user_profiles_insert_own" on public.panana_user_profiles;
create policy "user_profiles_insert_own"
on public.panana_user_profiles
for insert
to authenticated
with check (user_id = auth.uid());

-- 본인 프로필만 수정
drop policy if exists "user_profiles_update_own" on public.panana_user_profiles;
create policy "user_profiles_update_own"
on public.panana_user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

