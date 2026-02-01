-- panana_public_site_settings_v 뷰가 menu_visibility, recommendation_settings를 읽을 수 있도록 권한 부여
-- 에러: permission denied for table panana_site_settings (빌드 시 anon으로 접근)
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

-- menu_visibility, recommendation_settings 컬럼에 대한 SELECT 권한 추가
grant select (id, site_name, site_description, metadata_base, social_image_url, robots_index, footer_line_1, footer_line_2, menu_visibility, recommendation_settings, updated_at)
on table public.panana_site_settings to anon, authenticated;
