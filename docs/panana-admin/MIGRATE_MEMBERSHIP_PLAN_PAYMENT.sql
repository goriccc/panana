-- 멤버십 플랜에 결제코드(SKU)·결제금액(KRW) 추가
-- 실행: Supabase SQL Editor에서 실행

alter table public.panana_membership_plans
  add column if not exists payment_sku text,
  add column if not exists price_krw int;

comment on column public.panana_membership_plans.payment_sku is '결제 연동용 상품 SKU (예: panana_pass_monthly)';
comment on column public.panana_membership_plans.price_krw is '결제 금액(KRW)';
