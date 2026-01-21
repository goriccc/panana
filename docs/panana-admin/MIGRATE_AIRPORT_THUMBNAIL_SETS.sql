-- Migration: Airport thumbnail sets (image + optional video)
-- 목적: panana_airport_media(단일 미디어 row) 대신 "세트" 단위로 관리
-- - 한 세트는 image(필수) + video(선택) 를 가질 수 있음
-- - Storage 업로드 키를 set_id 기준으로 고정하여 "마지막 업로드만 남는 문제" 제거
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

-- enums 재사용
-- public.panana_airport_section: ('immigration','complete')

create table if not exists public.panana_airport_thumbnail_sets (
  id uuid primary key default gen_random_uuid(),
  section public.panana_airport_section not null,
  title text not null default '',
  image_path text not null default '', -- storage object path (ex: immigration/<id>/image.jpg)
  video_path text not null default '', -- storage object path (ex: immigration/<id>/video.mp4) or '' if none
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_airport_thumbnail_sets_touch on public.panana_airport_thumbnail_sets;
create trigger panana_airport_thumbnail_sets_touch
before update on public.panana_airport_thumbnail_sets
for each row execute function public.panana_touch_updated_at();

create index if not exists idx_panana_airport_thumbnail_sets_section on public.panana_airport_thumbnail_sets(section, sort_order);

-- 권한(Privilege) 복구: Admin UI(로그인=authenticated)가 접근 가능해야 함. 실제 제어는 RLS로.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.panana_airport_thumbnail_sets to authenticated;

-- RLS 정책: 관리자 allowlist 기반 CRUD
alter table public.panana_airport_thumbnail_sets enable row level security;

drop policy if exists "panana_airport_thumbnail_sets_admin_all" on public.panana_airport_thumbnail_sets;
create policy "panana_airport_thumbnail_sets_admin_all"
on public.panana_airport_thumbnail_sets
for all
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

