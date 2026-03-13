-- 맛보기(트라이얼) + 음성 사용량: 프로필 플래그, 일일 지급 이력, 음성 초 단위 기록
-- 전제: BILLING_SCHEMA.sql, BILLING_1_1_RATIO.sql, MIGRATE_SUBSCRIPTION_DAILY_GRANTS.sql 적용됨

-- 1) 프로필: 유료 전환 여부 (한 번이라도 충전/구독 결제 시 true)
alter table public.panana_billing_profiles
  add column if not exists has_ever_paid boolean not null default false;

comment on column public.panana_billing_profiles.has_ever_paid is '한 번이라도 충전 또는 구독 결제를 한 경우 true (맛보기 전용 구분용)';

-- 기존 유료 유저 보정
update public.panana_billing_profiles set has_ever_paid = true where is_subscriber = true or amount_base > 0;

-- 2) 맛보기 일일 100 P 지급 이력 (비구독자, 가입일 익일부터 방문 시 1회/일)
create table if not exists public.panana_trial_daily_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  grant_date date not null,
  amount_p int not null default 100,
  created_at timestamptz not null default now(),
  unique(user_id, grant_date)
);

create index if not exists idx_panana_trial_daily_grants_user_date
  on public.panana_trial_daily_grants (user_id, grant_date desc);

comment on table public.panana_trial_daily_grants is '맛보기(비구독자) 일일 100 P 지급 이력 (가입일 익일부터, 방문 시 1회/일)';

alter table public.panana_trial_daily_grants enable row level security;
drop policy if exists "panana_trial_daily_grants_deny_all" on public.panana_trial_daily_grants;
create policy "panana_trial_daily_grants_deny_all" on public.panana_trial_daily_grants for all using (false) with check (false);

-- 3) 음성 사용량 (무료 유저 30초/일 제한용, KST 기준 일별 합계)
create table if not exists public.panana_voice_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  usage_date date not null,
  seconds_used int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, usage_date)
);

create index if not exists idx_panana_voice_usage_user_date
  on public.panana_voice_usage (user_id, usage_date desc);

comment on table public.panana_voice_usage is '무료 유저 음성 사용 초 단위 (당일 합계, 30초 제한)';

alter table public.panana_voice_usage enable row level security;
drop policy if exists "panana_voice_usage_deny_all" on public.panana_voice_usage;
create policy "panana_voice_usage_deny_all" on public.panana_voice_usage for all using (false) with check (false);
