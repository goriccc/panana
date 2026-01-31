-- panana_chat_messages에 장면 이미지 URL 컬럼 추가
-- 실행: Supabase SQL Editor에서 실행

alter table public.panana_chat_messages
  add column if not exists scene_image_url text;
