-- Panana Admin RLS (ADMIN ONLY)
-- 목적: public(anon/authenticated) 읽기까지 전부 차단하고, 관리자만 읽기/쓰기 허용
--
-- 실행 순서:
-- 1) SCHEMA.sql
-- 2) (선택) RLS.sql를 이미 실행했다면, 이 파일이 정책을 교체(덮어씀)
-- 3) 관리자 등록:
--    insert into public.panana_admin_users (user_id) values ('YOUR_AUTH_USER_UUID');
--
-- 중요:
-- - 이 설정을 적용하면 "서비스 앱(anon key)"에서 panana_* 테이블을 직접 SELECT 할 수 없습니다.
-- - 운영 데이터는 서버(Service Role) 또는 별도 공개용 테이블/뷰로 제공해야 합니다.

-- 0) Admin allowlist 테이블(없으면 생성)
create table if not exists public.panana_admin_users (
  user_id uuid primary key, -- auth.users.id
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.panana_admin_users enable row level security;

-- 중요: RLS 재귀 방지 (본인 row만 SELECT 가능)
drop policy if exists "panana_admin_users_admin_all" on public.panana_admin_users;
drop policy if exists "panana_admin_users_select_self" on public.panana_admin_users;
create policy "panana_admin_users_select_self"
on public.panana_admin_users
for select
using (user_id = auth.uid() and active = true);

-- 1) RLS enable (테이블 전체)
alter table public.panana_categories enable row level security;
alter table public.panana_characters enable row level security;
alter table public.panana_character_categories enable row level security;
alter table public.panana_character_posts enable row level security;
alter table public.panana_home_hero_cards enable row level security;
alter table public.panana_notices enable row level security;
alter table public.panana_billing_products enable row level security;
alter table public.panana_membership_plans enable row level security;
alter table public.panana_airport_media enable row level security;
alter table public.panana_airport_copy enable row level security;
alter table public.panana_site_settings enable row level security;

-- 2) 기존 public 읽기 정책 제거 (있을 수도 있으니 안전하게 drop)
drop policy if exists "panana_categories_public_read" on public.panana_categories;
drop policy if exists "panana_characters_public_read" on public.panana_characters;
drop policy if exists "panana_character_categories_public_read" on public.panana_character_categories;
drop policy if exists "panana_character_posts_public_read" on public.panana_character_posts;
drop policy if exists "panana_home_hero_cards_public_read" on public.panana_home_hero_cards;
drop policy if exists "panana_notices_public_read_published" on public.panana_notices;
drop policy if exists "panana_billing_products_public_read" on public.panana_billing_products;
drop policy if exists "panana_membership_plans_public_read" on public.panana_membership_plans;
drop policy if exists "panana_airport_media_public_read" on public.panana_airport_media;
drop policy if exists "panana_airport_copy_public_read" on public.panana_airport_copy;
drop policy if exists "panana_site_settings_public_read" on public.panana_site_settings;

-- 3) 관리자만 ALL(읽기/쓰기) 정책 적용
-- 공통 admin 조건:
-- exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true)

drop policy if exists "panana_categories_admin_all" on public.panana_categories;
create policy "panana_categories_admin_all"
on public.panana_categories for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "panana_characters_admin_all" on public.panana_characters;
create policy "panana_characters_admin_all"
on public.panana_characters for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "panana_character_categories_admin_all" on public.panana_character_categories;
create policy "panana_character_categories_admin_all"
on public.panana_character_categories for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "panana_character_posts_admin_all" on public.panana_character_posts;
create policy "panana_character_posts_admin_all"
on public.panana_character_posts for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "panana_home_hero_cards_admin_all" on public.panana_home_hero_cards;
create policy "panana_home_hero_cards_admin_all"
on public.panana_home_hero_cards for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "panana_notices_admin_all" on public.panana_notices;
create policy "panana_notices_admin_all"
on public.panana_notices for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "panana_billing_products_admin_all" on public.panana_billing_products;
create policy "panana_billing_products_admin_all"
on public.panana_billing_products for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "panana_membership_plans_admin_all" on public.panana_membership_plans;
create policy "panana_membership_plans_admin_all"
on public.panana_membership_plans for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "panana_airport_media_admin_all" on public.panana_airport_media;
create policy "panana_airport_media_admin_all"
on public.panana_airport_media for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "panana_airport_copy_admin_all" on public.panana_airport_copy;
create policy "panana_airport_copy_admin_all"
on public.panana_airport_copy for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

drop policy if exists "panana_site_settings_admin_all" on public.panana_site_settings;
create policy "panana_site_settings_admin_all"
on public.panana_site_settings for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

