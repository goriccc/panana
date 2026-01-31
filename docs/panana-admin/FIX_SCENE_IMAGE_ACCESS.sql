-- scene_image 설정 컬럼 SELECT 권한 추가
-- anon이 panana_public_site_settings_v 뷰를 통해 scene_image_daily_limit 등을 읽을 수 있도록 함
-- 실행: Supabase SQL Editor에서 이 파일 실행

grant select (menu_visibility, scene_image_enabled, scene_image_daily_limit, scene_image_model, scene_image_steps, scene_image_vision_cache_minutes, recommendation_settings)
on table public.panana_site_settings to anon, authenticated;
