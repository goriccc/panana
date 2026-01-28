-- panana_site_settings 테이블에 recommendation_settings JSONB 필드 추가
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_site_settings
  add column if not exists recommendation_settings jsonb not null default '{}'::jsonb;

-- 기존 레코드 기본값 보정
update public.panana_site_settings
set recommendation_settings = coalesce(recommendation_settings, '{}'::jsonb);

-- PUBLIC_VIEWS.sql의 panana_public_site_settings_v에도 컬럼 노출 필요
-- (같은 파일에서 create or replace view를 갱신하세요)
