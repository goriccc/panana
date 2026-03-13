-- 충전 상품 6종 스펙 동기화 (1:1 + 보너스)
-- 전제: panana_billing_products 테이블 존재 (SCHEMA.sql)

insert into public.panana_billing_products (sku, title, pana_amount, bonus_amount, price_krw, recommended, sort_order, active)
values
  ('PANA_3000',  '설레는 첫걸음',  2900,  100,  2900,  false, 1, true),
  ('PANA_6500',  '가까워지는 우리', 5900,  600,  5900,  false, 2, true),
  ('PANA_15000', '깊어지는 대화', 12900, 2100, 12900, false, 3, true),
  ('PANA_35000', '둘만의 비밀',  29000, 6000, 29000, false, 4, true),
  ('PANA_60000', '끝없는 판타지', 49000, 11000, 49000, false, 5, true),
  ('PANA_120000','파나나 킹덤',  99000, 21000, 99000, true,  6, true)
on conflict (sku) do update set
  title = excluded.title,
  pana_amount = excluded.pana_amount,
  bonus_amount = excluded.bonus_amount,
  price_krw = excluded.price_krw,
  sort_order = excluded.sort_order,
  recommended = excluded.recommended,
  active = excluded.active,
  updated_at = now();
