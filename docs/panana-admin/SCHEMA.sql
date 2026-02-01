-- Panana Admin (Supabase/Postgres) Schema
-- 목적: 서비스 운영(Admin)에서 관리하는 콘텐츠/설정 테이블을 "한방"으로 생성
-- 테이블명 충돌 방지: panana_* prefix 사용 (Studio의 projects/characters 등과 별개)

-- 필요 확장(대부분 Supabase 기본 포함, 없으면 주석 해제)
-- create extension if not exists "pgcrypto";

-- updated_at 자동 갱신 트리거
create or replace function public.panana_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) 카테고리(홈/카테고리 상세)
create table if not exists public.panana_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_categories_touch on public.panana_categories;
create trigger panana_categories_touch
before update on public.panana_categories
for each row execute function public.panana_touch_updated_at();

-- 2) 캐릭터(앱 노출용 메타)
create table if not exists public.panana_characters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  profile_image_url text not null default '',
  posts_count int not null default 0,
  safety_supported boolean not null default false,
  gender text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_characters_touch on public.panana_characters;
create trigger panana_characters_touch
before update on public.panana_characters
for each row execute function public.panana_touch_updated_at();

-- 3) 캐릭터 ↔ 카테고리 매핑(홈 노출 연결)
create table if not exists public.panana_character_categories (
  character_id uuid not null references public.panana_characters(id) on delete cascade,
  category_id uuid not null references public.panana_categories(id) on delete cascade,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (character_id, category_id)
);

drop trigger if exists panana_character_categories_touch on public.panana_character_categories;
create trigger panana_character_categories_touch
before update on public.panana_character_categories
for each row execute function public.panana_touch_updated_at();

create index if not exists idx_panana_character_categories_category on public.panana_character_categories(category_id, sort_order);
create index if not exists idx_panana_character_categories_character on public.panana_character_categories(character_id, sort_order);

-- 4) 홈 상단 히어로 카드(공지/추천/바로가기)
create table if not exists public.panana_home_hero_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  image_url text not null default '',
  href text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_home_hero_cards_touch on public.panana_home_hero_cards;
create trigger panana_home_hero_cards_touch
before update on public.panana_home_hero_cards
for each row execute function public.panana_touch_updated_at();

-- 5) 공지사항
create table if not exists public.panana_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  body text not null default '',
  published_at timestamptz, -- null이면 비공개
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_notices_touch on public.panana_notices;
create trigger panana_notices_touch
before update on public.panana_notices
for each row execute function public.panana_touch_updated_at();

create index if not exists idx_panana_notices_published_at on public.panana_notices(published_at desc nulls last);

-- 6) 충전 상품
create table if not exists public.panana_billing_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  title text not null default '파나나 충전',
  pana_amount int not null default 0,
  bonus_amount int not null default 0,
  price_krw int not null default 0,
  recommended boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_billing_products_touch on public.panana_billing_products;
create trigger panana_billing_products_touch
before update on public.panana_billing_products
for each row execute function public.panana_touch_updated_at();

-- 7) 멤버십 플랜(단일/복수 모두 대응)
create table if not exists public.panana_membership_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  title text not null,
  price_label text not null,
  cta_text text not null default '지금 가입하기',
  benefits text[] not null default '{}'::text[],
  terms_url text not null default '/terms',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_membership_plans_touch on public.panana_membership_plans;
create trigger panana_membership_plans_touch
before update on public.panana_membership_plans
for each row execute function public.panana_touch_updated_at();

-- 8) 공항/입국 플로우: 미디어(입국심사/입국통과 썸네일)
create type public.panana_airport_section as enum ('immigration','complete');
create type public.panana_media_kind as enum ('image','video');

create table if not exists public.panana_airport_media (
  id uuid primary key default gen_random_uuid(),
  section public.panana_airport_section not null,
  kind public.panana_media_kind not null default 'image',
  title text not null default '',
  media_url text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_airport_media_touch on public.panana_airport_media;
create trigger panana_airport_media_touch
before update on public.panana_airport_media
for each row execute function public.panana_touch_updated_at();

create index if not exists idx_panana_airport_media_section on public.panana_airport_media(section, sort_order);

-- 9) 공항/입국 플로우: 입국심사 안내 문장(복수 문장 가능)
create table if not exists public.panana_airport_copy (
  id uuid primary key default gen_random_uuid(),
  key text not null, -- 예: 'immigration_intro'
  text text not null default '',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(key, sort_order)
);

drop trigger if exists panana_airport_copy_touch on public.panana_airport_copy;
create trigger panana_airport_copy_touch
before update on public.panana_airport_copy
for each row execute function public.panana_touch_updated_at();

-- 10) 사이트 설정(푸터/SEO)
create table if not exists public.panana_site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'Panana',
  site_description text not null default '',
  metadata_base text not null default '',
  social_image_url text not null default '',
  robots_index boolean not null default true,
  footer_line_1 text not null default '© Panana',
  footer_line_2 text not null default '',
  recommendation_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_site_settings_touch on public.panana_site_settings;
create trigger panana_site_settings_touch
before update on public.panana_site_settings
for each row execute function public.panana_touch_updated_at();

-- 11) 인기 캐릭터 캐시
create table if not exists public.panana_popular_cache (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_panana_popular_cache_key_updated
on public.panana_popular_cache (key, updated_at desc);

drop trigger if exists panana_popular_cache_touch on public.panana_popular_cache;
create trigger panana_popular_cache_touch
before update on public.panana_popular_cache
for each row execute function public.panana_touch_updated_at();

-- 12) Seed(선택) - 빈 프로젝트에서도 어드민 화면이 바로 보이도록 최소 데이터
insert into public.panana_categories (slug, title, sort_order, active)
values
  ('for-me', '나에게 맞는', 1, true),
  ('new', '새로 올라온', 2, true),
  ('loved', '모두에게 사랑받는', 3, true)
on conflict (slug) do nothing;

insert into public.panana_site_settings (site_description, metadata_base, social_image_url, footer_line_2)
values ('버블챗/제타 스타일의 캐릭터 채팅 경험을 Panana에서 시작해보세요.', 'https://panana.local', '/panana.png', '문의: support@panana.app')
on conflict do nothing;

-- ===== RLS(선택) =====
-- 운영 정책에 따라 Admin은 별도 인증/권한을 붙이는 것을 권장합니다.
-- 여기서는 "일단 생성" 목적이라 RLS는 비활성(기본)로 둡니다.
-- RLS를 켜고 정책을 넣고 싶으면, 각 테이블에 대해 enable row level security + policy를 추가하세요.

