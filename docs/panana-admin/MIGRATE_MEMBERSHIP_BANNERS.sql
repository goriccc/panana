-- 멤버십 배너(복수) - 어드민 등록 → 프론트 멤버십 화면 노출
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

create extension if not exists pgcrypto;

create table if not exists public.panana_membership_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  image_path text not null default '', -- Supabase Storage object key (bucket: panana-membership)
  image_url text not null default '',  -- public URL (캐싱/프론트 렌더 최적화용)
  link_url text not null default '',   -- 클릭 시 이동할 URL(내부/외부 모두 가능)
  sort_order int not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_panana_membership_banners_active_order
on public.panana_membership_banners(active, sort_order, created_at);

drop trigger if exists panana_membership_banners_touch on public.panana_membership_banners;
create trigger panana_membership_banners_touch
before update on public.panana_membership_banners
for each row execute function public.panana_touch_updated_at();

alter table public.panana_membership_banners enable row level security;

-- 공개 읽기: active + 기간 조건(기간이 비어있으면 항상 노출)
drop policy if exists "panana_membership_banners_public_read" on public.panana_membership_banners;
create policy "panana_membership_banners_public_read"
on public.panana_membership_banners for select
using (
  active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or now() <= ends_at)
);

-- 관리자 allowlist: 전체 권한
drop policy if exists "panana_membership_banners_admin_all" on public.panana_membership_banners;
create policy "panana_membership_banners_admin_all"
on public.panana_membership_banners for all
using (
  exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

