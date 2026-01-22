-- PananaAI Studio: 캐릭터(등장인물) 공개 프로필 메타 컬럼 추가
-- 목적: Studio(저작)에서 앱 노출용 메타(이름/핸들/태그/소개/상태)를 저장하고
--      Admin에서 Studio 캐릭터 연결 시 1회 자동 채움(A)로 가져오기 위함.
-- 실행: Supabase SQL Editor에서 실행

alter table public.characters
  add column if not exists handle text not null default '',
  add column if not exists hashtags text[] not null default '{}'::text[],
  add column if not exists tagline text not null default '',
  add column if not exists intro_title text not null default '',
  add column if not exists intro_lines text[] not null default '{}'::text[],
  add column if not exists mood_title text not null default '',
  add column if not exists mood_lines text[] not null default '{}'::text[];

