-- Panana Storage (Scene Images)
-- 목적: 채팅 장면 이미지(Fal.ai 생성) 영구 저장
--
-- Fal.ai URL은 7일 후 만료되므로, 생성 직후 Supabase에 업로드하여 영구 보관합니다.
-- 파나나 고객이 마이에서 대화창을 유지하는 동안 생성한 이미지를 계속 볼 수 있도록 합니다.
--
-- 권장 운영:
-- - 업로드: API 서버(service role)만 수행
-- - 다운로드: 공개 읽기(앱에서 이미지 표시)
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

-- 1) 버킷 생성
insert into storage.buckets (id, name, public)
values ('panana-scene-images', 'panana-scene-images', true)
on conflict (id) do update set public = excluded.public;

-- 2) 공개 읽기(채팅에서 장면 이미지 표시)
drop policy if exists "panana_scene_images_public_read" on storage.objects;
create policy "panana_scene_images_public_read"
on storage.objects for select
using (bucket_id = 'panana-scene-images');

-- 3) 업로드: service role 사용 시 RLS 우회로 업로드 가능
-- (API 라우트에서 SUPABASE_SERVICE_ROLE_KEY로 업로드)

-- 4) 권장 경로 규칙
-- panana-scene-images/<panana_id>/<timestamp>_<short_id>.webp
-- (Fal.ai JPG → Sharp WebP quality 88 변환으로 용량 최소화, 품질 유지)
