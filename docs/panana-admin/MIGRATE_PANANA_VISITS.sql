-- Migration: Panana visits (유입 로그)
-- 목적:
-- - 어드민 대시보드 "유입통계" (총유입수/유니크 유입수) 집계용
-- - 클라이언트에서 페이지 뷰 시 1건 insert (visitor_id는 선택: 쿠키/핑거프린트로 유니크 유입 계산)
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

create table if not exists public.panana_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_panana_visits_created_at
on public.panana_visits (created_at desc);

create index if not exists idx_panana_visits_visitor_created
on public.panana_visits (visitor_id, created_at desc)
where visitor_id is not null;

alter table public.panana_visits enable row level security;

drop policy if exists "panana_visits_deny_all" on public.panana_visits;
create policy "panana_visits_deny_all"
on public.panana_visits for all
using (false) with check (false);

-- 서비스 역할만 접근 (API/미들웨어에서 SUPABASE_SERVICE_ROLE_KEY 사용)
-- insert는 클라이언트가 /api/visit 또는 미들웨어를 통해 서버에서만 수행 권장
