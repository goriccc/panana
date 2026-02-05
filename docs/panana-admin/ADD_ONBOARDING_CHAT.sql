-- 채팅 온보딩 메시지 관리
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행
-- line1에서 {{icon}}은 채팅 UI에서 지문 아이콘 이미지로 치환됩니다.

-- 1) onboarding_chat 컬럼 추가
alter table public.panana_site_settings
  add column if not exists onboarding_chat jsonb not null default '{"line1": "지문: 입력창 왼쪽 {{icon}} 버튼으로 상황·행동 묘사를 넣을 수 있어요.", "line2": "장면 이미지: 이미지생성 버튼을 눌러 생성할 수 있어요."}'::jsonb;

-- 2) 뷰에 onboarding_chat 추가 (PUBLIC_VIEWS.sql과 동일한 구조)
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
  scene_image_enabled,
  scene_image_daily_limit,
  scene_image_model,
  scene_image_steps,
  scene_image_vision_cache_minutes,
  menu_visibility,
  updated_at,
  recommendation_settings,
  coalesce(onboarding_chat, '{"line1": "지문: 입력창 왼쪽 {{icon}} 버튼으로 상황·행동 묘사를 넣을 수 있어요.", "line2": "장면 이미지: 이미지생성 버튼을 눌러 생성할 수 있어요."}'::jsonb) as onboarding_chat
from public.panana_site_settings
order by updated_at desc
limit 1;
