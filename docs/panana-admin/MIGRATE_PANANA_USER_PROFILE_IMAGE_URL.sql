-- Migration: panana_users.profile_image_url
-- 목적: 마이페이지 프로필 이미지 URL을 DB에 저장하여 도전 랭킹 등에서 표시
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_users
  add column if not exists profile_image_url text;
