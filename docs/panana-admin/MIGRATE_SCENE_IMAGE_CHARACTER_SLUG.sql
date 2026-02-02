-- Migration: panana_scene_image_log에 character_slug 컬럼 추가
-- 목적: 대화 중 이미지 생성 시 캐릭터별 생성 수 집계 (어드민 대시보드 남성/여성 톱20)
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_scene_image_log
  add column if not exists character_slug text;

create index if not exists idx_panana_scene_image_log_character_created
on public.panana_scene_image_log (character_slug, created_at desc)
where character_slug is not null;
