-- 구독 관리: 다음 결제일 계산용 시작일, 해지 시 빌링키 삭제용 키 저장
-- 실행 순서: BILLING_SCHEMA / MIGRATE_TRIAL_AND_VOICE 등 기존 billing 프로필 테이블 이후

alter table public.panana_billing_profiles
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_billing_key text;

comment on column public.panana_billing_profiles.subscription_started_at is '멤버십 최초 결제 성공 시점(KST). 다음 결제일 = 이 날짜 + 30일';
comment on column public.panana_billing_profiles.subscription_billing_key is '포트원 빌링키. 구독 해지 시 DELETE /billing-keys/{billingKey} 호출용';
