-- Panana Admin Storage (Characters)
-- 목적: 캐릭터 프로필 이미지 업로드/수정/삭제를 위해 Storage 버킷과 권한을 설정
--
-- 권장 운영:
-- - 업로드/삭제: 관리자만 허용 (public.panana_admin_users allowlist)
-- - 다운로드(이미지 표시): 공개 허용(앱에서 프로필 이미지 표시 가능)
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

-- 1) 버킷 생성(없으면 생성)
insert into storage.buckets (id, name, public)
values ('panana-characters', 'panana-characters', true)
on conflict (id) do update set public = excluded.public;

-- 2) Storage 정책 (storage.objects)
-- 2-1) 공개 읽기(프로필 이미지 표시)
drop policy if exists "panana_characters_public_read" on storage.objects;
create policy "panana_characters_public_read"
on storage.objects for select
using (bucket_id = 'panana-characters');

-- 2-2) 관리자만 업로드(INSERT)
drop policy if exists "panana_characters_admin_insert" on storage.objects;
create policy "panana_characters_admin_insert"
on storage.objects for insert
with check (
  bucket_id = 'panana-characters'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- 2-3) 관리자만 수정(UPDATE)
drop policy if exists "panana_characters_admin_update" on storage.objects;
create policy "panana_characters_admin_update"
on storage.objects for update
using (
  bucket_id = 'panana-characters'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
)
with check (
  bucket_id = 'panana-characters'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- 2-4) 관리자만 삭제(DELETE)
drop policy if exists "panana_characters_admin_delete" on storage.objects;
create policy "panana_characters_admin_delete"
on storage.objects for delete
using (
  bucket_id = 'panana-characters'
  and exists (
    select 1 from public.panana_admin_users a
    where a.user_id = auth.uid() and a.active = true
  )
);

-- 3) 권장 경로 규칙(문서용)
-- - 프로필 이미지: panana-characters/profiles/<character_id>
-- 확장자 없이 고정 키로 업서트하면 교체가 간단합니다.

