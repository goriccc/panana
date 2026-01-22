-- Panana Admin Migration: character meta 확장 + Studio 연결 키
-- 목적:
-- - 홈/카테고리/프로필에서 필요한 @handle, tags, 소개문구 등을 DB에서 관리
-- - Studio(저작) 캐릭터와 앱(노출) 캐릭터를 studio_character_id로 연결

-- 1) panana_characters 컬럼 확장
alter table public.panana_characters
  add column if not exists handle text not null default '',
  add column if not exists hashtags text[] not null default '{}'::text[],
  add column if not exists mbti text not null default '',
  add column if not exists intro_title text not null default '소개합니다!',
  add column if not exists intro_lines text[] not null default '{}'::text[],
  add column if not exists mood_title text not null default '요즘 어때?',
  add column if not exists mood_lines text[] not null default '{}'::text[],
  add column if not exists followers_count int not null default 0,
  add column if not exists following_count int not null default 0,
  add column if not exists studio_character_id uuid;

create index if not exists idx_panana_characters_studio_character_id on public.panana_characters(studio_character_id);

-- 2) (선택) 프로필 게시물 테이블 (이미지 그리드용)
create table if not exists public.panana_character_posts (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.panana_characters(id) on delete cascade,
  image_url text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_character_posts_touch on public.panana_character_posts;
create trigger panana_character_posts_touch
before update on public.panana_character_posts
for each row execute function public.panana_touch_updated_at();

create index if not exists idx_panana_character_posts_character on public.panana_character_posts(character_id, sort_order);

