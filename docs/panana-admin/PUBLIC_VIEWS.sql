-- Panana Admin Public Views
-- 목적: panana_* 원본 테이블은 admin-only로 잠그고,
--       서비스 앱(anon/authenticated)은 "공개용 뷰"만 SELECT 가능하게 운영.
--
-- 전제:
-- - panana_* 테이블은 RLS_ADMIN_ONLY.sql로 admin-only 상태
-- - 이 뷰는 "안전한 컬럼 + 안전한 WHERE(active/published)"만 노출
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

-- (선택) 테이블 직접 접근 권한 제거(보수적으로)
-- ⚠️주의: authenticated까지 revoke 하면 관리자(로그인 유저)도 permission denied가 납니다.
-- 따라서 anon만 revoke하고, 접근 통제는 RLS로 처리하는 것을 권장합니다.
revoke all on table public.panana_categories from anon;
revoke all on table public.panana_characters from anon;
revoke all on table public.panana_character_categories from anon;
revoke all on table public.panana_home_hero_cards from anon;
revoke all on table public.panana_notices from anon;
revoke all on table public.panana_billing_products from anon;
revoke all on table public.panana_membership_plans from anon;
revoke all on table public.panana_airport_media from anon;
revoke all on table public.panana_airport_copy from anon;
revoke all on table public.panana_site_settings from anon;

-- 1) 카테고리(공개)
create or replace view public.panana_public_categories_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  slug,
  title,
  sort_order
from public.panana_categories
where active = true
order by sort_order asc;

-- 2) 캐릭터(공개)
create or replace view public.panana_public_characters_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  slug,
  name,
  tagline,
  profile_image_url,
  posts_count
from public.panana_characters
where active = true
order by updated_at desc;

-- 3) 캐릭터-카테고리 매핑(공개)
create or replace view public.panana_public_character_categories_v
with (security_barrier=true, security_invoker=true)
as
select
  cc.category_id,
  c.slug as category_slug,
  cc.character_id,
  ch.slug as character_slug,
  cc.sort_order
from public.panana_character_categories cc
join public.panana_categories c on c.id = cc.category_id
join public.panana_characters ch on ch.id = cc.character_id
where cc.active = true and c.active = true and ch.active = true
order by c.sort_order asc, cc.sort_order asc;

-- 4) 홈 히어로 카드(공개)
create or replace view public.panana_public_home_hero_cards_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  title,
  subtitle,
  image_url,
  href,
  sort_order
from public.panana_home_hero_cards
where active = true
order by sort_order asc;

-- 5) 공지사항(공개: 게시된 것만)
create or replace view public.panana_public_notices_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  title,
  summary,
  body,
  published_at
from public.panana_notices
where published_at is not null and published_at <= now()
order by published_at desc;

-- 6) 충전 상품(공개)
create or replace view public.panana_public_billing_products_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  sku,
  title,
  pana_amount,
  bonus_amount,
  price_krw,
  recommended,
  sort_order
from public.panana_billing_products
where active = true
order by sort_order asc;

-- 7) 멤버십 플랜(공개)
create or replace view public.panana_public_membership_plans_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  plan_key,
  title,
  price_label,
  cta_text,
  benefits,
  terms_url,
  sort_order
from public.panana_membership_plans
where active = true
order by sort_order asc;

-- 8) 공항 미디어(공개)
create or replace view public.panana_public_airport_media_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  section,
  kind,
  title,
  media_url,
  sort_order
from public.panana_airport_media
where active = true
order by section asc, sort_order asc;

-- 8-1) 공항 썸네일 세트(공개) - 신규(이미지+선택 동영상)
-- NOTE: MIGRATE_AIRPORT_THUMBNAIL_SETS.sql 실행 후 사용
create or replace view public.panana_public_airport_thumbnail_sets_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  section,
  title,
  image_path,
  video_path,
  sort_order
from public.panana_airport_thumbnail_sets
where active = true
order by section asc, sort_order asc;

-- 9) 공항 문장(공개)
create or replace view public.panana_public_airport_copy_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  key,
  text,
  sort_order
from public.panana_airport_copy
where active = true
order by key asc, sort_order asc;

-- 10) 사이트 설정(공개: 최신 1개)
create or replace view public.panana_public_site_settings_v
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
  footer_line_2
from public.panana_site_settings
order by updated_at desc
limit 1;

-- 11) 뷰 권한 부여(서비스 앱에서 읽기 허용)
grant select on public.panana_public_categories_v to anon, authenticated;
grant select on public.panana_public_characters_v to anon, authenticated;
grant select on public.panana_public_character_categories_v to anon, authenticated;
grant select on public.panana_public_home_hero_cards_v to anon, authenticated;
grant select on public.panana_public_notices_v to anon, authenticated;
grant select on public.panana_public_billing_products_v to anon, authenticated;
grant select on public.panana_public_membership_plans_v to anon, authenticated;
grant select on public.panana_public_airport_media_v to anon, authenticated;
grant select on public.panana_public_airport_thumbnail_sets_v to anon, authenticated;
grant select on public.panana_public_airport_copy_v to anon, authenticated;
grant select on public.panana_public_site_settings_v to anon, authenticated;

