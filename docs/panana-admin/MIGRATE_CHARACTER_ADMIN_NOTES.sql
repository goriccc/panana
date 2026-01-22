-- Panana Admin: 캐릭터 내부 운영 메모 컬럼 추가
-- 목적: /admin/characters 의 "메모(어드민 내부용)" 필드를 DB에 저장/로드하기 위함
-- 실행: Supabase SQL editor에서 실행

alter table public.panana_characters
  add column if not exists admin_notes text;

