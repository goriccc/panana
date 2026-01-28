-- Migration: Adult verification status
-- 목적:
-- - 성인 인증 여부를 panana_users에 저장
-- - 스파이시(NSFW) 정책 게이트에 사용
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_users
  add column if not exists adult_verified boolean not null default false,
  add column if not exists adult_verified_at timestamptz;

create index if not exists idx_panana_users_adult_verified
on public.panana_users (adult_verified, adult_verified_at);
