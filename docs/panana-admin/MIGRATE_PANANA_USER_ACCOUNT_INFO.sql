-- Migration: Panana user account info (birth/gender)
-- 목적:
-- - 마이페이지 > 계정설정의 "내 정보(생년월일/성별)"를 DB에 저장
-- - airport/chat Step.4 입력과 동일 데이터로 연동
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_users
  add column if not exists birth_yyyymmdd text,
  add column if not exists gender text;

-- (선택) 값 무결성: 기존 데이터가 없을 수 있어 NOT NULL/DEFAULT는 두지 않습니다.
-- gender는 'female' | 'male' | 'both' | 'private' 만 허용(값이 없으면 NULL)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'panana_users_gender_check'
  ) then
    alter table public.panana_users
      add constraint panana_users_gender_check
      check (gender is null or gender in ('female','male','both','private'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'panana_users_birth_yyyymmdd_check'
  ) then
    alter table public.panana_users
      add constraint panana_users_birth_yyyymmdd_check
      check (birth_yyyymmdd is null or birth_yyyymmdd ~ '^[0-9]{8}$');
  end if;
end $$;

