-- Panana Admin Public Views
-- 목적: panana_* 원본 테이블은 admin-only로 잠그고,
--       서비스 앱(anon/authenticated)은 "공개용 뷰"만 SELECT 가능하게 운영.
--
-- 전제:
-- - panana_* 테이블은 RLS_ADMIN_ONLY.sql로 admin-only 상태
-- - 이 뷰는 "안전한 컬럼 + 안전한 WHERE(active/published)"만 노출
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

-- ============================================================
-- B안(Security Advisor "Security Definer View" 제거) 운영 가이드
-- - 이 파일의 뷰는 security_invoker=true 로 생성됩니다.
-- - 따라서 원본 panana_* 테이블에 대해 "필요 컬럼만" SELECT 권한을 부여해야 합니다.
-- - 또한 RLS 정책이 public read를 허용해야 합니다(활성/게시된 것만).
--
-- ⚠️ 주의:
-- - docs/panana-admin/RLS_ADMIN_ONLY.sql 을 적용해두면 public read가 전부 막힙니다.
--   B안을 쓰려면 RLS_ADMIN_ONLY 대신 RLS.sql(공개 읽기 허용) 계열을 사용하세요.
-- ============================================================

-- (선택) 테이블 직접 접근 권한 제거(보수적으로)
-- ⚠️주의: authenticated까지 revoke 하면 관리자(로그인 유저)도 permission denied가 납니다.
-- 따라서 anon만 revoke하고, 접근 통제는 RLS로 처리하는 것을 권장합니다.
revoke all on table public.panana_categories from anon;
revoke all on table public.panana_characters from anon;
revoke all on table public.panana_character_categories from anon;
revoke all on table public.panana_character_posts from anon;
revoke all on table public.panana_home_hero_cards from anon;
revoke all on table public.panana_notices from anon;
revoke all on table public.panana_billing_products from anon;
revoke all on table public.panana_membership_plans from anon;
revoke all on table public.panana_membership_banners from anon;
revoke all on table public.panana_airport_media from anon;
revoke all on table public.panana_airport_copy from anon;
revoke all on table public.panana_site_settings from anon;

-- B안: invoker-view용 최소 컬럼 권한(anon/authenticated)
-- (RLS가 row를 제한, column privilege가 민감 컬럼 누출을 막음)
grant select (id, slug, title, sort_order, active) on table public.panana_categories to anon, authenticated;

grant select (
  id, slug, name, tagline, profile_image_url, posts_count, active,
  handle, hashtags, mbti, intro_title, intro_lines, mood_title, mood_lines,
  followers_count, following_count, studio_character_id, safety_supported, created_at, updated_at
) on table public.panana_characters to anon, authenticated;

-- admin_notes 같은 내부 컬럼은 권한을 주지 않습니다.

grant select (character_id, category_id, sort_order, active, created_at) on table public.panana_character_categories to anon, authenticated;
grant select (id, character_id, image_url, sort_order, active) on table public.panana_character_posts to anon, authenticated;

grant select (id, title, subtitle, image_url, href, sort_order, active) on table public.panana_home_hero_cards to anon, authenticated;
grant select (id, title, summary, body, published_at) on table public.panana_notices to anon, authenticated;

grant select (id, sku, title, pana_amount, bonus_amount, price_krw, recommended, sort_order, active)
on table public.panana_billing_products to anon, authenticated;

grant select (id, plan_key, title, price_label, cta_text, benefits, terms_url, sort_order, active)
on table public.panana_membership_plans to anon, authenticated;

grant select (id, title, image_path, image_url, link_url, sort_order, active, starts_at, ends_at)
on table public.panana_membership_banners to anon, authenticated;

grant select (id, section, kind, title, media_url, sort_order, active) on table public.panana_airport_media to anon, authenticated;
grant select (id, key, text, sort_order, active) on table public.panana_airport_copy to anon, authenticated;

grant select (id, site_name, site_description, metadata_base, social_image_url, robots_index, footer_line_1, footer_line_2, updated_at)
on table public.panana_site_settings to anon, authenticated;

-- 썸네일 세트 테이블이 존재할 때만(마이그레이션 이후) 권한 부여
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'panana_airport_thumbnail_sets'
  ) then
    execute 'grant select (id, section, title, image_path, video_path, sort_order, active) on table public.panana_airport_thumbnail_sets to anon, authenticated';
  end if;
end $$;

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
  posts_count,
  handle,
  hashtags,
  mbti,
  intro_title,
  intro_lines,
  mood_title,
  mood_lines,
  followers_count,
  following_count,
  studio_character_id,
  safety_supported
from public.panana_characters
where active = true
order by updated_at desc;

-- 2-1) 카테고리 카드(홈/카테고리 상세에서 ContentCard로 그리기 위한 뷰)
create or replace view public.panana_public_category_cards_v
with (security_barrier=true, security_invoker=true)
as
select
  c.slug as category_slug,
  c.title as category_title,
  c.sort_order as category_sort_order,
  (row_number() over (
    partition by c.id
    order by
      case when c.slug = 'new' then ch.created_at else null end desc,
      cc.sort_order asc,
      ch.created_at desc,
      cc.created_at desc
  ))::int as item_sort_order,
  ch.slug as character_slug,
  nullif(ch.handle,'') as author_handle,
  ch.name as title,
  ch.tagline as description,
  ch.hashtags as tags,
  nullif(ch.profile_image_url,'') as character_profile_image_url,
  ch.safety_supported as safety_supported
from public.panana_character_categories cc
join public.panana_categories c on c.id = cc.category_id
join public.panana_characters ch on ch.id = cc.character_id
where cc.active = true and c.active = true and ch.active = true
order by c.sort_order asc, item_sort_order asc;

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

-- 3-1) 캐릭터 게시물(공개: active만)
create or replace view public.panana_public_character_posts_v
with (security_barrier=true, security_invoker=true)
as
select
  p.id,
  ch.slug as character_slug,
  p.image_url,
  p.sort_order
from public.panana_character_posts p
join public.panana_characters ch on ch.id = p.character_id
where p.active = true and ch.active = true
order by ch.updated_at desc, p.sort_order asc;

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

-- 7-1) 멤버십 배너(공개: 복수)
create or replace view public.panana_public_membership_banners_v
with (security_barrier=true, security_invoker=true)
as
select
  id,
  title,
  image_path,
  image_url,
  link_url,
  sort_order
from public.panana_membership_banners
where
  active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or now() <= ends_at)
-- NOTE: security_invoker=true인 뷰는 ORDER BY에 사용되는 컬럼도 invoker가 SELECT 권한이 필요합니다.
-- 아래에서는 created_at을 쓰지 않고 id로 tie-break 하여, 추가 컬럼 권한 없이도 동작하게 합니다.
order by sort_order asc, id asc;

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
  footer_line_2,
  menu_visibility,
  updated_at,
  recommendation_settings
from public.panana_site_settings
order by updated_at desc
limit 1;

-- 11) 뷰 권한 부여(서비스 앱에서 읽기 허용)
grant select on public.panana_public_categories_v to anon, authenticated;
grant select on public.panana_public_characters_v to anon, authenticated;
grant select on public.panana_public_character_categories_v to anon, authenticated;
grant select on public.panana_public_category_cards_v to anon, authenticated;
grant select on public.panana_public_character_posts_v to anon, authenticated;
grant select on public.panana_public_home_hero_cards_v to anon, authenticated;
grant select on public.panana_public_notices_v to anon, authenticated;
grant select on public.panana_public_billing_products_v to anon, authenticated;
grant select on public.panana_public_membership_plans_v to anon, authenticated;
grant select on public.panana_public_membership_banners_v to anon, authenticated;
grant select on public.panana_public_airport_media_v to anon, authenticated;
grant select on public.panana_public_airport_thumbnail_sets_v to anon, authenticated;
grant select on public.panana_public_airport_copy_v to anon, authenticated;
grant select on public.panana_public_site_settings_v to anon, authenticated;
-- ⚠️ 주의:
-- security_invoker=true 뷰는 "원본 테이블 SELECT 권한"이 필요합니다.
-- 또한 어드민 UI는 authenticated로 panana_site_settings를 직접 읽고/수정합니다.
-- 따라서 authenticated는 revoke 하지 말고, anon만 revoke(보수적)합니다.
revoke all on table public.panana_site_settings from anon;

