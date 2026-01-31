-- 장면 이미지 스텝 수 8~20 설정 (기존 scene_image_model 대체)
-- 실행: Supabase SQL Editor에서 실행
-- 선행: ADD_SCENE_IMAGE_VISION_CACHE.sql

-- 1) scene_image_steps 컬럼 추가 (8~20, 기본 20)
alter table public.panana_site_settings
  add column if not exists scene_image_steps int;

-- 2) 기존 scene_image_model에서 마이그레이션
update public.panana_site_settings
set scene_image_steps = case when scene_image_model = 'schnell' then 8 else 20 end
where scene_image_steps is null;

-- 3) 기본값 및 NOT NULL 적용
alter table public.panana_site_settings
  alter column scene_image_steps set default 20;

update public.panana_site_settings
set scene_image_steps = 20
where scene_image_steps is null;

alter table public.panana_site_settings
  alter column scene_image_steps set not null;

-- 4) panana_public_site_settings_v 뷰에 scene_image_steps 추가
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
  coalesce(greatest(8, least(20, scene_image_steps)), 20) as scene_image_steps,
  coalesce(greatest(0, least(10080, scene_image_vision_cache_minutes)), 60) as scene_image_vision_cache_minutes,
  updated_at,
  coalesce(recommendation_settings, '{}'::jsonb) as recommendation_settings
from public.panana_site_settings
order by updated_at desc
limit 1;

grant select on public.panana_public_site_settings_v to anon, authenticated;
