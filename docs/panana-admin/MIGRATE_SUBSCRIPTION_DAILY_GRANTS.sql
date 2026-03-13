-- 구독자 매일 500 P 지급 이력 (중복 지급 방지 + 월 캡 계산용)
-- 전제: BILLING_SCHEMA.sql, BILLING_1_1_RATIO.sql 적용됨

create table if not exists public.panana_subscription_daily_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  grant_date date not null,
  amount_p int not null default 500,
  created_at timestamptz not null default now(),
  unique(user_id, grant_date)
);

create index if not exists idx_panana_subscription_daily_grants_user_date
  on public.panana_subscription_daily_grants (user_id, grant_date desc);

comment on table public.panana_subscription_daily_grants is '파나나 패스 구독자 일일 500 P 지급 이력 (일 1회, 월 30,000 P 캡)';

alter table public.panana_subscription_daily_grants enable row level security;
drop policy if exists "panana_subscription_daily_grants_deny_all" on public.panana_subscription_daily_grants;
create policy "panana_subscription_daily_grants_deny_all" on public.panana_subscription_daily_grants for all using (false) with check (false);
