-- Panana Billing & Usage Schema
-- 목적: 가상 통화(Panana P), 충전/사용/보너스 트랜잭션, 모델별 사용량 로그
-- 전제: public.panana_users 존재 (MIGRATE_PANANA_USERS.sql 선행)

-- 1) billing profiles (명세의 profiles: user_id, panana_balance, is_subscriber, subscription_type, last_login_at)
create table if not exists public.panana_billing_profiles (
  user_id uuid primary key references public.panana_users(id) on delete cascade,
  panana_balance bigint not null default 0,
  is_subscriber boolean not null default false,
  subscription_type text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_billing_profiles_touch on public.panana_billing_profiles;
create trigger panana_billing_profiles_touch
before update on public.panana_billing_profiles
for each row execute function public.panana_touch_updated_at();

comment on table public.panana_billing_profiles is '유저별 파나나 잔액 및 구독 상태';
comment on column public.panana_billing_profiles.panana_balance is 'Panana(P) 잔액, 단위: P';
comment on column public.panana_billing_profiles.subscription_type is '예: panana_pass';

-- 2) transactions (충전/사용/보너스)
create type public.panana_transaction_type as enum ('recharge', 'usage', 'bonus');

create table if not exists public.panana_billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  amount bigint not null,
  type public.panana_transaction_type not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_panana_billing_transactions_user_created
on public.panana_billing_transactions (user_id, created_at desc);

comment on table public.panana_billing_transactions is 'P 충전/차감/보너스 내역';
comment on column public.panana_billing_transactions.amount is 'P 단위, recharge/bonus는 양수, usage는 음수 권장(또는 절대값+type으로 구분)';

-- 3) usage_logs (모델별 토큰/차감량)
create type public.panana_usage_mode as enum ('normal', 'nsfw');

create table if not exists public.panana_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  model_used text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  p_deducted bigint not null default 0,
  mode public.panana_usage_mode not null default 'normal',
  created_at timestamptz not null default now()
);

create index if not exists idx_panana_usage_logs_user_created
on public.panana_usage_logs (user_id, created_at desc);

comment on table public.panana_usage_logs is '채팅/음성 등 모델 사용량 및 P 차감 기록';

-- 4) RLS (서버만 접근, 클라이언트 직접 접근 차단)
alter table public.panana_billing_profiles enable row level security;
alter table public.panana_billing_transactions enable row level security;
alter table public.panana_usage_logs enable row level security;

drop policy if exists "panana_billing_profiles_deny_all" on public.panana_billing_profiles;
create policy "panana_billing_profiles_deny_all" on public.panana_billing_profiles for all using (false) with check (false);

drop policy if exists "panana_billing_transactions_deny_all" on public.panana_billing_transactions;
create policy "panana_billing_transactions_deny_all" on public.panana_billing_transactions for all using (false) with check (false);

drop policy if exists "panana_usage_logs_deny_all" on public.panana_usage_logs;
create policy "panana_usage_logs_deny_all" on public.panana_usage_logs for all using (false) with check (false);
