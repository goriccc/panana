-- 충전 건당 결제 금액(KRW) 저장: 충전내역 화면에서 "충전금액" 표시용
-- 전제: BILLING_SCHEMA.sql, BILLING_1_1_RATIO.sql 적용됨.

alter table public.panana_billing_transactions
  add column if not exists amount_krw int;

comment on column public.panana_billing_transactions.amount_krw is 'Recharge only: payment amount in KRW. Null for usage/bonus.';
