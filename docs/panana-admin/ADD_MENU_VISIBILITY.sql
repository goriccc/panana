-- 메뉴 노출 설정 추가
-- panana_site_settings 테이블에 menu_visibility JSON 필드 추가

alter table public.panana_site_settings
add column if not exists menu_visibility jsonb not null default '{"my": true, "home": true, "challenge": true, "ranking": true, "search": true}'::jsonb;

-- 기존 레코드가 있으면 기본값으로 업데이트
update public.panana_site_settings
set menu_visibility = '{"my": true, "home": true, "challenge": true, "ranking": true, "search": true}'::jsonb
where menu_visibility is null;

-- 공개 뷰에 menu_visibility 추가
create or replace view public.panana_public_site_settings_v
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
  menu_visibility,
  updated_at
from public.panana_site_settings
order by updated_at desc
limit 1;

-- 권한 부여
grant select (id, site_name, site_description, metadata_base, social_image_url, robots_index, footer_line_1, footer_line_2, menu_visibility, updated_at)
on table public.panana_site_settings to anon, authenticated;
