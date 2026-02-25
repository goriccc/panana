-- Panana Character Follows (캐릭터↔캐릭터, 캐릭터→유저) + N회 대화 기준
-- 목적:
-- - 동일 태그/관리자 지정으로 캐릭터 간 팔로우
-- - N회 이상 대화 시 캐릭터가 유저를 팔로우
--
-- 실행: Supabase SQL Editor에서 실행

-- 1) 캐릭터가 캐릭터를 팔로우 (맞팔·동일태그·관리자 지정)
create table if not exists public.panana_character_follows (
  follower_character_slug text not null,
  following_character_slug text not null,
  created_at timestamptz not null default now(),
  primary key (follower_character_slug, following_character_slug),
  check (follower_character_slug <> following_character_slug)
);

create index if not exists idx_panana_character_follows_following
  on public.panana_character_follows (following_character_slug);

comment on table public.panana_character_follows is '캐릭터가 캐릭터를 팔로우. 동일태그 맞팔·관리자 수동 지정용.';

alter table public.panana_character_follows enable row level security;
drop policy if exists "panana_character_follows_deny_all" on public.panana_character_follows;
create policy "panana_character_follows_deny_all"
  on public.panana_character_follows for all using (false) with check (false);

-- 2) 캐릭터가 유저를 팔로우 (N회 대화 조건 달성 시)
create table if not exists public.panana_character_follows_user (
  character_slug text not null,
  panana_id uuid not null references public.panana_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (character_slug, panana_id)
);

create index if not exists idx_panana_character_follows_user_slug
  on public.panana_character_follows_user (character_slug);

comment on table public.panana_character_follows_user is '캐릭터가 유저를 팔로우. N회 이상 대화 시 자동 추가.';

alter table public.panana_character_follows_user enable row level security;
drop policy if exists "panana_character_follows_user_deny_all" on public.panana_character_follows_user;
create policy "panana_character_follows_user_deny_all"
  on public.panana_character_follows_user for all using (false) with check (false);

-- 3) N회 대화 기준값 (사이트 설정)
alter table public.panana_site_settings
  add column if not exists character_follows_user_after_messages int not null default 10;

comment on column public.panana_site_settings.character_follows_user_after_messages is '유저가 해당 캐릭터에게 보낸 메시지가 이 수 이상이면 캐릭터가 유저를 팔로우.';
