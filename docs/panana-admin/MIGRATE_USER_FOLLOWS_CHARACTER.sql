-- Panana User Follows Character (유저가 캐릭터 팔로우)
-- 목적:
-- - 유저가 캐릭터 상세에서 팔로우 버튼으로 추가한 관계 저장
-- - 캐릭터의 "팔로워" 수 = panana_characters.followers_count(관리자/동일태그) + 이 테이블 count
--
-- 실행: Supabase SQL Editor에서 실행

create table if not exists public.panana_user_follows_character (
  panana_id uuid not null references public.panana_users(id) on delete cascade,
  character_slug text not null,
  created_at timestamptz not null default now(),
  primary key (panana_id, character_slug)
);

create index if not exists idx_panana_user_follows_character_slug
  on public.panana_user_follows_character (character_slug);

comment on table public.panana_user_follows_character is '유저가 캐릭터를 팔로우한 관계. 캐릭터 팔로워 수 집계에 사용.';

alter table public.panana_user_follows_character enable row level security;

-- deny-all; API는 service_role로 접근
drop policy if exists "panana_user_follows_character_deny_all" on public.panana_user_follows_character;
create policy "panana_user_follows_character_deny_all"
  on public.panana_user_follows_character
  for all
  using (false)
  with check (false);
