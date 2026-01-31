-- 장면 이미지 기능: site_settings + 사용 로그 테이블
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행
-- 선행: ADD_MENU_VISIBILITY.sql, ADD_RECOMMENDATION_SETTINGS.sql (뷰에 menu_visibility, recommendation_settings 필요)

-- 1) panana_site_settings에 장면 이미지 설정 컬럼 추가
alter table public.panana_site_settings
  add column if not exists scene_image_enabled boolean not null default true;
alter table public.panana_site_settings
  add column if not exists scene_image_daily_limit int not null default 5;

-- 2) 일일 쿼터 로그 테이블 (유저당 당일 사용 횟수 카운트용)
create table if not exists public.panana_scene_image_log (
  id uuid primary key default gen_random_uuid(),
  panana_id uuid not null references public.panana_users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_panana_scene_image_log_panana_created
on public.panana_scene_image_log (panana_id, created_at desc);

alter table public.panana_scene_image_log enable row level security;
drop policy if exists "panana_scene_image_log_deny_all" on public.panana_scene_image_log;
create policy "panana_scene_image_log_deny_all"
on public.panana_scene_image_log for all
using (false) with check (false);

-- 서비스 역할만 접근 (API route에서 SUPABASE_SERVICE_ROLE_KEY 사용)
-- grant는 RLS로 차단되므로 service_role은 bypass

-- 3) panana_public_site_settings_v 뷰 업데이트 (scene_image 설정 노출)
-- 기존 뷰에 scene_image_enabled, scene_image_daily_limit 추가
-- DROP 후 CREATE: 컬럼 추가 시 CREATE OR REPLACE는 순서 충돌로 오류 발생
drop view if exists public.panana_public_site_settings_v;
create view public.panana_public_site_settings_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  site_name,
  site_description,
  metadata_base,
  social_image_url,
  robots_index,
  footer_line_1,
  footer_line_2,
  coalesce(menu_visibility, '{}'::jsonb) as menu_visibility,
  coalesce(scene_image_enabled, true) as scene_image_enabled,
  coalesce(scene_image_daily_limit, 5) as scene_image_daily_limit,
  updated_at,
  coalesce(recommendation_settings, '{}'::jsonb) as recommendation_settings
from public.panana_site_settings
order by updated_at desc
limit 1;

-- 권한 복원 (DROP 시 revoke됨)
grant select on public.panana_public_site_settings_v to anon, authenticated;
