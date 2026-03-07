-- Billing 1:1 Ratio (1 KRW = 1 P) – Schema Additions
-- Final Spec: amount_base (Cash) + amount_bonus (Free). Consume bonus before base. Margin 80%.
-- 전제: BILLING_SCHEMA.sql 적용됨. profiles/transactions 테이블 존재.

-- 1) Profiles: split balance into amount_base (Actual Cash Value) and amount_bonus
alter table public.panana_billing_profiles
  add column if not exists amount_base bigint not null default 0,
  add column if not exists amount_bonus bigint not null default 0;

comment on column public.panana_billing_profiles.amount_base is 'P from paid recharge (1 KRW = 1 P). Consumed after amount_bonus.';
comment on column public.panana_billing_profiles.amount_bonus is 'P from bonus (promo/daily). Consumed first.';

-- Optional: keep panana_balance as total for backward compat; app can set panana_balance = amount_base + amount_bonus on write.
-- If you prefer a generated column (PG 12+):
-- alter table public.panana_billing_profiles drop column if exists panana_balance;
-- alter table public.panana_billing_profiles add column panana_balance bigint generated always as (amount_base + amount_bonus) stored;
-- For now we keep panana_balance as a regular column; app must keep it in sync with amount_base + amount_bonus.

-- 2) Transactions: base / bonus / total for recharge; usage can keep amount or add deducted_base/deducted_bonus later
alter table public.panana_billing_transactions
  add column if not exists amount_base bigint,
  add column if not exists amount_bonus bigint,
  add column if not exists total_amount bigint;

comment on column public.panana_billing_transactions.amount_base is 'Recharge: paid P (Price KRW = P). Usage: deducted from base.';
comment on column public.panana_billing_transactions.amount_bonus is 'Recharge: bonus P. Usage: deducted from bonus first.';
comment on column public.panana_billing_transactions.total_amount is 'Recharge: amount_base + amount_bonus.';

-- Backfill: existing rows keep amount; set total_amount = amount, amount_base = amount, amount_bonus = 0 for recharge
update public.panana_billing_transactions
set total_amount = amount, amount_base = amount, amount_bonus = 0
where type = 'recharge' and total_amount is null;

update public.panana_billing_transactions
set total_amount = amount
where type in ('usage','bonus') and total_amount is null;

-- Backfill profiles: treat existing panana_balance as amount_base so balance is preserved
update public.panana_billing_profiles
set amount_base = greatest(0, panana_balance), amount_bonus = 0
where amount_base = 0 and amount_bonus = 0 and panana_balance > 0;
