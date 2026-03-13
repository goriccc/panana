-- 맛보기 매일 지급: 가입일 익일부터 적립 (가입일 당일은 일일 지급 없음)
-- 전제: MIGRATE_TRIAL_AND_VOICE.sql 적용됨

alter table public.panana_billing_profiles
  add column if not exists trial_started_at date;

comment on column public.panana_billing_profiles.trial_started_at is '맛보기 가입일(KST). 일일 100 P는 이 날짜 익일부터 지급';
