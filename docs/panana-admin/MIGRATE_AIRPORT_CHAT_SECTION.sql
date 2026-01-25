-- Migration: Add airport section for "immigration chat (in progress)"
-- 목적:
-- - /airport(시작)와 /airport/chat(입국심사중)을 분리해서 썸네일/영상 관리
-- - 기존 'immigration'은 유지, 새 섹션이 비어있으면 프론트에서 'immigration'으로 폴백
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

do $$
begin
  alter type public.panana_airport_section add value if not exists 'immigration_chat';
exception
  when duplicate_object then null;
end $$;

