-- 장면 이미지 모델 선택: Flux.1 [dev] vs [schnell]
-- 실행: Supabase SQL Editor에서 이 파일 실행
-- 선행: ADD_SCENE_IMAGE_SETTINGS.sql

-- 1) scene_image_model 컬럼 추가
alter table public.panana_site_settings
  add column if not exists scene_image_model text not null default 'dev';

-- 'dev' | 'schnell' 제약 (선택)
-- alter table public.panana_site_settings add constraint chk_scene_image_model
--   check (scene_image_model in ('dev', 'schnell'));

-- 2) panana_public_site_settings_v 뷰에 scene_image_model 추가
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
  coalesce(nullif(trim(scene_image_model), ''), 'dev') as scene_image_model,
  updated_at,
  coalesce(recommendation_settings, '{}'::jsonb) as recommendation_settings
from public.panana_site_settings
order by updated_at desc
limit 1;

grant select on public.panana_public_site_settings_v to anon, authenticated;
