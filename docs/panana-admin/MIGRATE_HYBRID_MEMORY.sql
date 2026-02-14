-- Hybrid Memory: 장기 요약 + 유저 프로필 (캐릭터별 유저 기억)
-- 목적: 200k 토큰 한계를 넘어 "우리 대화를 다 기억하는" 느낌을 주기 위함
-- - panana_memory_summaries: 대화를 감정 위주 3인칭 요약으로 누적
-- - panana_memory_profile: 유저 이름/직업/호불호/고민 등 키-밸류 추출
--
-- 실행: Supabase SQL Editor에서 실행

-- 장기 기억: 챕터별 요약 (대화 N턴마다 요약본 추가)
create table if not exists public.panana_memory_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  character_slug text not null,
  summary_text text not null,
  user_turn_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists panana_memory_summaries_user_slug_idx
on public.panana_memory_summaries (user_id, character_slug, created_at);

alter table public.panana_memory_summaries enable row level security;
drop policy if exists "panana_memory_summaries_deny_all" on public.panana_memory_summaries;
create policy "panana_memory_summaries_deny_all"
on public.panana_memory_summaries for all using (false) with check (false);

-- 유저 프로필: 캐릭터별로 추출한 유저 정보 (이름, 직업, 애완동물, 호불호, 고민 등)
create table if not exists public.panana_memory_profile (
  user_id uuid not null references public.panana_users(id) on delete cascade,
  character_slug text not null,
  profile_json jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, character_slug)
);

alter table public.panana_memory_profile enable row level security;
drop policy if exists "panana_memory_profile_deny_all" on public.panana_memory_profile;
create policy "panana_memory_profile_deny_all"
on public.panana_memory_profile for all using (false) with check (false);
