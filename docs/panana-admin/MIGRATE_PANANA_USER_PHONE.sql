-- Migration: panana_users.phone_number (이니시스 등 PG 구매자 휴대폰 필수 대응)
-- 목적: 구글/네이버/카카오 로그인 유저는 OAuth에서 휴대폰을 받지 않으므로, 앱에서 입력·저장 후 결제 시 사용
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_users
  add column if not exists phone_number text;

comment on column public.panana_users.phone_number is '구매자 휴대폰 번호(이니시스 V2 등 결제 시 필수). 하이픈 제외 010xxxxxxxx 형식 권장.';
