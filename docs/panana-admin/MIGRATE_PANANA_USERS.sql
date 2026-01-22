-- Panana: Users + Social Identity Mapping
-- 목적:
-- - 소셜 로그인 여부와 무관하게 "파나나 고유번호(@abcd1234)"를 서버에서 UNIQUE 보장 발급
-- - 소셜 로그인(provider, providerAccountId)과 panana_user_id 매핑
--
-- 실행: Supabase SQL Editor에서 실행

-- 0) (필요 시) UUID 생성 함수
-- create extension if not exists "pgcrypto";

-- 1) panana_users: 서버가 발급/확정하는 유저 레코드(표시용 handle + 랜덤 닉네임 포함)
create table if not exists public.panana_users (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 기존 테이블에 nickname 컬럼이 없다면 추가(안전)
alter table public.panana_users add column if not exists nickname text;

-- 2) panana_user_identities: 소셜 로그인 계정 ↔ panana_users 매핑
create table if not exists public.panana_user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  created_at timestamptz not null default now(),
  unique(provider, provider_account_id),
  unique(user_id, provider)
);

-- 3) updated_at 자동 갱신(기존 panana_touch_updated_at 사용)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'panana_touch_updated_at') then
    begin
      create trigger panana_users_touch_updated_at
      before update on public.panana_users
      for each row execute function public.panana_touch_updated_at();
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- 4) RLS(선택)
alter table public.panana_users enable row level security;
alter table public.panana_user_identities enable row level security;

-- NOTE:
-- 이 프로젝트는 서버 API에서 SUPABASE_SERVICE_ROLE_KEY로만 insert/update 하도록 설계.
-- service_role은 RLS를 우회하므로, 별도 정책 없이도 동작합니다.

-- Security Advisor 대응:
-- RLS가 켜져 있는데 policy가 0개면 경고가 뜹니다.
-- 아래 deny-all 정책은 anon/authenticated 등 모든 역할의 직접 접근을 차단합니다.
-- (service_role은 RLS bypass)
drop policy if exists "panana_users_deny_all" on public.panana_users;
create policy "panana_users_deny_all"
on public.panana_users
for all
using (false)
with check (false);

drop policy if exists "panana_user_identities_deny_all" on public.panana_user_identities;
create policy "panana_user_identities_deny_all"
on public.panana_user_identities
for all
using (false)
with check (false);

