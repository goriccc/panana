-- Panana Membership Storage (Supabase Storage Buckets + Policies)
-- 목적: 멤버십 배너 이미지 업로드/수정/삭제를 위해 Storage 버킷과 권한을 설정
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

-- 1) 버킷 생성(없으면 생성)
insert into storage.buckets (id, name, public)
values ('panana-membership', 'panana-membership', true)
on conflict (id) do update set public = excluded.public;

-- 2) Storage 정책 (storage.objects)

-- 2-1) 공개 읽기(배너 표시)
drop policy if exists "panana_membership_public_read" on storage.objects;
create policy "panana_membership_public_read"
on storage.objects for select
using (bucket_id = 'panana-membership');

-- 2-2) 관리자만 업로드(INSERT)
drop policy if exists "panana_membership_admin_insert" on storage.objects;
create policy "panana_membership_admin_insert"
on storage.objects for insert
with check (
  bucket_id = 'panana-membership'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- 2-3) 관리자만 수정(UPDATE)
drop policy if exists "panana_membership_admin_update" on storage.objects;
create policy "panana_membership_admin_update"
on storage.objects for update
using (
  bucket_id = 'panana-membership'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  bucket_id = 'panana-membership'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- 2-4) 관리자만 삭제(DELETE)
drop policy if exists "panana_membership_admin_delete" on storage.objects;
create policy "panana_membership_admin_delete"
on storage.objects for delete
using (
  bucket_id = 'panana-membership'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

