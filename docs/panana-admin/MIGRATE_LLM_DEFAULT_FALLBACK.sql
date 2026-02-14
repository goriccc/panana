-- LLM 기본/성인 폴백 설정 (어드민에서 설정, 채팅 기본=Claude / 성인 수위 시 Gemini 폴백)
alter table public.panana_site_settings
  add column if not exists llm_default_provider text not null default 'anthropic',
  add column if not exists llm_fallback_provider text not null default 'gemini',
  add column if not exists llm_fallback_model text not null default 'gemini-2.5-flash';

comment on column public.panana_site_settings.llm_default_provider is '기본 대화 LLM 프로바이더(anthropic/gemini/deepseek)';
comment on column public.panana_site_settings.llm_fallback_provider is '성인 수위 시 폴백 프로바이더(클로드 자체검열 회피용)';
comment on column public.panana_site_settings.llm_fallback_model is '성인 수위 시 폴백 모델명(예: Gemini 2.5 Flash)';

-- 뷰 재생성: 기존 컬럼 순서(PUBLIC_VIEWS 기준) 유지 + 끝에 LLM 컬럼 3개 추가
-- CREATE OR REPLACE 시 컬럼 순서가 다르면 "column rename" 오류가 나므로 DROP 후 CREATE
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
  scene_image_enabled,
  scene_image_daily_limit,
  scene_image_model,
  scene_image_steps,
  scene_image_vision_cache_minutes,
  menu_visibility,
  updated_at,
  recommendation_settings,
  coalesce(nullif(trim(llm_default_provider), ''), 'anthropic') as llm_default_provider,
  coalesce(nullif(trim(llm_fallback_provider), ''), 'gemini') as llm_fallback_provider,
  coalesce(nullif(trim(llm_fallback_model), ''), 'gemini-2.5-flash') as llm_fallback_model
from public.panana_site_settings
order by updated_at desc
limit 1;

grant select on public.panana_public_site_settings_v to anon, authenticated;
