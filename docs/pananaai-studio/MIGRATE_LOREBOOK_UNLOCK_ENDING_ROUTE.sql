-- Studio Lorebook Unlock Ending Route Migration
-- 목적:
-- 1) unlock_type enum에 'ending_route' 추가
-- 2) lorebook_entries에 unlock_ending_key, unlock_ep_min 컬럼 추가
--
-- NOTE:
-- Postgres enum 확장은 트랜잭션 제약이 있을 수 있으나,
-- 이 스크립트는 enum 추가 후 "그 값을 사용하는 UPDATE"를 하지 않으므로 단일 실행로도 안전합니다.

-- 0) unlock_type enum 확장
do $$
begin
  begin
    alter type public.unlock_type add value if not exists 'ending_route';
  exception
    when undefined_object then
      raise notice 'public.unlock_type does not exist. Run SCHEMA.sql first.';
  end;
end $$;

-- 1) 컬럼 추가
alter table if exists public.lorebook_entries
  add column if not exists unlock_ending_key text;

alter table if exists public.lorebook_entries
  add column if not exists unlock_ep_min int;

