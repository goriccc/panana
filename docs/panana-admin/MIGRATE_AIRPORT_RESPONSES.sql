-- Migration: Airport step answers (purpose/mood/character_type)
-- 목적:
-- - airport/chat Step.1~3 답변을 user_id 기준으로 저장(최신 1개 업서트)
-- - Step.4(내 정보)는 panana_users로 저장(별도 migration 참고)
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

create table if not exists public.panana_airport_responses (
  user_id uuid primary key references public.panana_users(id) on delete cascade,
  purpose text not null default '',
  mood text not null default '',
  character_type text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_airport_responses_touch on public.panana_airport_responses;
create trigger panana_airport_responses_touch
before update on public.panana_airport_responses
for each row execute function public.panana_touch_updated_at();

alter table public.panana_airport_responses enable row level security;

-- Security Advisor 대응: 직접 접근 차단(service_role만 사용)
drop policy if exists "panana_airport_responses_deny_all" on public.panana_airport_responses;
create policy "panana_airport_responses_deny_all"
on public.panana_airport_responses
for all
using (false)
with check (false);

