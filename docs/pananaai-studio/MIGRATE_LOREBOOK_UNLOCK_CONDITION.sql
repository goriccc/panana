-- Studio Lorebook Unlock Condition Migration
-- 목적:
-- 1) unlock_type enum에 'condition' 추가
-- 2) lorebook_entries에 unlock_expr, unlock_cost_panana 컬럼 추가
-- 3) 과거 Import가 unlock_sku에 "COND:..." 로 보존하던 데이터를 정식 컬럼으로 변환

-- 중요:
-- Postgres는 "새 enum 값 추가"와 "그 enum 값을 사용하는 UPDATE"를 같은 트랜잭션에서 수행하면
-- `unsafe use of new value ...` 에러가 납니다.
-- 따라서 아래 마이그레이션은 반드시 2단계로 나눠 실행하세요:
--  - STEP 1) 이 파일: enum 확장 + 컬럼 추가만 수행
--  - STEP 2) `MIGRATE_LOREBOOK_UNLOCK_CONDITION_STEP2.sql`: 데이터 변환(UPDATE) 수행

-- STEP 1) unlock_type enum 확장
do $$
begin
  begin
    alter type public.unlock_type add value if not exists 'condition';
  exception
    when undefined_object then
      -- unlock_type이 아직 없으면 SCHEMA.sql을 먼저 실행하세요.
      raise notice 'public.unlock_type does not exist. Run SCHEMA.sql first.';
  end;
end $$;

-- STEP 1) 컬럼 추가
alter table if exists public.lorebook_entries
  add column if not exists unlock_expr text;

alter table if exists public.lorebook_entries
  add column if not exists unlock_cost_panana int;

