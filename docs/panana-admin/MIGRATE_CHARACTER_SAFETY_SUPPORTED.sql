-- Migration: Character safety support flag (adult chat allowed when enabled)
-- 목적:
-- - 홈의 "세이프티" 토글(ON) 시, 세이프티 지원 캐릭터만 노출
-- - 채팅 API에서 allowUnsafe 요청을 받더라도, safety_supported=true 인 캐릭터만 허용
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_characters
  add column if not exists safety_supported boolean not null default false;

