-- Panana Admin RLS (Supabase/Postgres)
-- 목적: Security Advisor의 "RLS Disabled in Public" 경고 제거 + 안전한 접근 제어 기본값 제공
--
-- 정책 컨셉:
-- 1) Public(anon) 읽기: 서비스 앱에서 필요한 테이블은 SELECT 허용(공지사항은 published만)
-- 2) Admin 쓰기: panana_admin_users에 등록된 사용자만 INSERT/UPDATE/DELETE 허용
--
-- 사용 방법:
-- 1) 먼저 docs/panana-admin/SCHEMA.sql 실행
-- 2) 그 다음 이 파일 전체를 Supabase SQL Editor에서 실행
-- 3) 관리자 계정 등록:
--    insert into public.panana_admin_users (user_id) values ('YOUR_AUTH_USER_UUID');

-- 0) Admin allowlist 테이블
create table if not exists public.panana_admin_users (
  user_id uuid primary key, -- auth.users.id
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.panana_admin_users enable row level security;

-- 중요:
-- panana_admin_users에서 "자기 테이블을 exists로 조회"하는 정책은 RLS 재귀를 유발할 수 있습니다.
-- 따라서 "본인 row만 SELECT 가능" 정책으로 단순화(부트스트랩/관리는 SQL Editor에서 수행 권장)
drop policy if exists "panana_admin_users_admin_all" on public.panana_admin_users;
drop policy if exists "panana_admin_users_select_self" on public.panana_admin_users;
create policy "panana_admin_users_select_self"
on public.panana_admin_users
for select
using (user_id = auth.uid() and active = true);

-- Helper: admin 체크(반복을 줄이기 위해 주석으로만 사용)
-- exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true)

-- 1) RLS enable
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

-- 2) Public SELECT policies (anon 포함)
drop policy if exists "panana_categories_public_read" on public.panana_categories;
create policy "panana_categories_public_read"
on public.panana_categories for select
using (active = true);

drop policy if exists "panana_characters_public_read" on public.panana_characters;
create policy "panana_characters_public_read"
on public.panana_characters for select
using (active = true);

drop policy if exists "panana_character_categories_public_read" on public.panana_character_categories;
create policy "panana_character_categories_public_read"
on public.panana_character_categories for select
using (active = true);

drop policy if exists "panana_character_posts_public_read" on public.panana_character_posts;
create policy "panana_character_posts_public_read"
on public.panana_character_posts for select
using (active = true);

drop policy if exists "panana_home_hero_cards_public_read" on public.panana_home_hero_cards;
create policy "panana_home_hero_cards_public_read"
on public.panana_home_hero_cards for select
using (active = true);

-- 공지사항은 공개된 것만(게시일이 미래면 숨김)
drop policy if exists "panana_notices_public_read_published" on public.panana_notices;
create policy "panana_notices_public_read_published"
on public.panana_notices for select
using (published_at is not null and published_at <= now());

drop policy if exists "panana_billing_products_public_read" on public.panana_billing_products;
create policy "panana_billing_products_public_read"
on public.panana_billing_products for select
using (active = true);

drop policy if exists "panana_membership_plans_public_read" on public.panana_membership_plans;
create policy "panana_membership_plans_public_read"
on public.panana_membership_plans for select
using (active = true);

drop policy if exists "panana_airport_media_public_read" on public.panana_airport_media;
create policy "panana_airport_media_public_read"
on public.panana_airport_media for select
using (active = true);

drop policy if exists "panana_airport_copy_public_read" on public.panana_airport_copy;
create policy "panana_airport_copy_public_read"
on public.panana_airport_copy for select
using (active = true);

drop policy if exists "panana_site_settings_public_read" on public.panana_site_settings;
create policy "panana_site_settings_public_read"
on public.panana_site_settings for select
using (true);

-- 3) Admin ALL policies (insert/update/delete 포함)
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

