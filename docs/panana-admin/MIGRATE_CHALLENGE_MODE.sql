-- 도전 모드: 챌린지 테이블, 완료/포기 기록, 랭킹 기간 설정
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행
-- 선행: MIGRATE_PANANA_USERS.sql, SCHEMA.sql (panana_characters)

-- 1) panana_challenges: 도전 시나리오 (캐릭터 FK 참조)
create table if not exists public.panana_challenges (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.panana_characters(id) on delete cascade,
  title text not null,
  challenge_goal text not null default '',
  challenge_situation text not null default '',
  success_keywords text[] not null default '{}',
  partial_match boolean not null default true,
  gender text check (gender in ('female', 'male', 'both')),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists panana_challenges_touch on public.panana_challenges;
create trigger panana_challenges_touch
before update on public.panana_challenges
for each row execute function public.panana_touch_updated_at();

create index if not exists idx_panana_challenges_active_sort
on public.panana_challenges (active, sort_order) where active = true;
create index if not exists idx_panana_challenges_character
on public.panana_challenges (character_id);

-- 2) panana_challenge_sessions: 도전 시도 중 (첫 메시지 시 시작)
create table if not exists public.panana_challenge_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  challenge_id uuid not null references public.panana_challenges(id) on delete cascade,
  started_at timestamptz not null default now(),
  unique(user_id, challenge_id)
);

create index if not exists idx_panana_challenge_sessions_lookup
on public.panana_challenge_sessions (user_id, challenge_id);

-- 3) panana_challenge_completions: 성공 기록 (랭킹)
create table if not exists public.panana_challenge_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  challenge_id uuid not null references public.panana_challenges(id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  duration_ms bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_panana_challenge_completions_ranking
on public.panana_challenge_completions (challenge_id, duration_ms, completed_at);

create index if not exists idx_panana_challenge_completions_user
on public.panana_challenge_completions (user_id, challenge_id);

-- 4) panana_challenge_give_ups: 포기 기록 (통계용)
create table if not exists public.panana_challenge_give_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  challenge_id uuid not null references public.panana_challenges(id) on delete cascade,
  started_at timestamptz not null,
  gave_up_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_panana_challenge_give_ups_challenge
on public.panana_challenge_give_ups (challenge_id, gave_up_at);

-- 5) 랭킹 기간 설정 (panana_site_settings)
alter table public.panana_site_settings
  add column if not exists challenge_ranking_days int not null default 30;

-- RLS (service_role 사용 시 bypass)
alter table public.panana_challenges enable row level security;
alter table public.panana_challenge_sessions enable row level security;
alter table public.panana_challenge_completions enable row level security;
alter table public.panana_challenge_give_ups enable row level security;

drop policy if exists "panana_challenges_deny_all" on public.panana_challenges;
create policy "panana_challenges_deny_all" on public.panana_challenges for all using (false) with check (false);

drop policy if exists "panana_challenge_sessions_deny_all" on public.panana_challenge_sessions;
create policy "panana_challenge_sessions_deny_all" on public.panana_challenge_sessions for all using (false) with check (false);

drop policy if exists "panana_challenge_completions_deny_all" on public.panana_challenge_completions;
create policy "panana_challenge_completions_deny_all" on public.panana_challenge_completions for all using (false) with check (false);

drop policy if exists "panana_challenge_give_ups_deny_all" on public.panana_challenge_give_ups;
create policy "panana_challenge_give_ups_deny_all" on public.panana_challenge_give_ups for all using (false) with check (false);
