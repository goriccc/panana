-- Migration: panana_users.profile_note (캐릭터가 기억할 유저 정보)
-- 목적: 계정설정에서 입력한 "캐릭터가 기억할 나에 대한 정보"를 DB에 저장하고, 채팅 시 system prompt에 주입
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_users
  add column if not exists profile_note text;

-- RLS는 기존과 동일(service_role만 접근). 별도 정책 추가 없음.
