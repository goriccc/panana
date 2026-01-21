-- Panana Admin Storage (Supabase Storage Buckets + Policies)
-- 목적: 공항/입국 플로우 썸네일(이미지/동영상) 업로드/수정/삭제를 위해 Storage 버킷과 권한을 설정
--
-- 권장 운영:
-- - 업로드/삭제: 관리자만 허용 (public.panana_admin_users allowlist)
-- - 다운로드(미디어 표시): 공개 허용(앱에서 썸네일 표시 가능)
--
-- 전제:
-- - Auth 사용(관리자 로그인 시 auth.uid() 사용 가능)
-- - RLS_ADMIN_ONLY.sql 또는 RLS.sql로 panana_admin_users 테이블이 존재
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

-- 1) 버킷 생성(없으면 생성)
-- public = true 로 두면 객체 URL을 공개로 접근 가능(썸네일 표시용)
insert into storage.buckets (id, name, public)
values ('panana-airport', 'panana-airport', true)
on conflict (id) do update set public = excluded.public;

-- 2) Storage 정책 (storage.objects)
-- RLS 활성화는 Supabase에서 기본되어 있으며, policy 추가로 제어합니다.

-- 2-1) 공개 읽기(썸네일 표시)
drop policy if exists "panana_airport_public_read" on storage.objects;
create policy "panana_airport_public_read"
on storage.objects for select
using (bucket_id = 'panana-airport');

-- 2-2) 관리자만 업로드(INSERT)
drop policy if exists "panana_airport_admin_insert" on storage.objects;
create policy "panana_airport_admin_insert"
on storage.objects for insert
with check (
  bucket_id = 'panana-airport'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- 2-3) 관리자만 수정(UPDATE)
drop policy if exists "panana_airport_admin_update" on storage.objects;
create policy "panana_airport_admin_update"
on storage.objects for update
using (
  bucket_id = 'panana-airport'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  bucket_id = 'panana-airport'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- 2-4) 관리자만 삭제(DELETE)
drop policy if exists "panana_airport_admin_delete" on storage.objects;
create policy "panana_airport_admin_delete"
on storage.objects for delete
using (
  bucket_id = 'panana-airport'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- 3) 권장 경로 규칙(문서용)
-- - immigration 썸네일: panana-airport/immigration/<uuid>.<ext>
-- - complete 썸네일:    panana-airport/complete/<uuid>.<ext>
-- 실제 업로드 구현 시 object key를 위 규칙으로 생성하면 운영이 편합니다.

