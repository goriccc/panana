-- Fix: permission denied for public.panana_airport_media (Admin UI)
-- 목적: authenticated(로그인)에서 DB 접근 자체가 막히거나, RLS 정책 누락으로 막히는 경우를 한방에 복구
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

-- 1) 테이블 privilege 복구(로그인 유저 role=authenticated)
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.panana_airport_media to authenticated;
grant select on table public.panana_admin_users to authenticated;

-- 2) RLS 활성 + 정책 복구(관리자 allowlist 기반)
alter table public.panana_admin_users enable row level security;
alter table public.panana_airport_media enable row level security;

-- panana_admin_users: 본인 row만 조회 가능(재귀 방지)
drop policy if exists "panana_admin_users_select_self" on public.panana_admin_users;
create policy "panana_admin_users_select_self"
on public.panana_admin_users
for select
using (user_id = auth.uid() and active = true);

-- panana_airport_media: 관리자만 CRUD (public 읽기는 공개용 뷰/버킷으로 제공 권장)
drop policy if exists "panana_airport_media_admin_all" on public.panana_airport_media;
create policy "panana_airport_media_admin_all"
on public.panana_airport_media
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

