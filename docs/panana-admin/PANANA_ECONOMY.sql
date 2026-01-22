-- Panana Economy (파나나 크레딧 기반)
-- 목적:
-- - 충전(결제)로 얻은 "파나나"를 지갑에 적립하고
-- - 씬/비밀/끼어듦/리셋/프리미엄 모드 해금 시 파나나를 차감하며
-- - 모든 증감을 원장(ledger)으로 남겨 운영/정산/CS를 가능하게 합니다.
--
-- 전제:
-- - Supabase Auth 사용(auth.users.id = auth.uid())
-- - 결제 연동은 추후(현재는 지갑/해금 구조만)

create type public.panana_ledger_kind as enum (
  'grant',          -- 운영자 지급/이벤트 지급
  'purchase',       -- 결제 충전 적립
  'spend_unlock',   -- 해금 차감
  'spend_premium',  -- 프리미엄 모드 차감(또는 이용권 차감)
  'refund',         -- 환불/차감 취소
  'adjust'          -- 운영자 조정
);

create type public.panana_unlock_kind as enum (
  'scene',          -- EP/씬 해금
  'secret',         -- 반전/비밀 해금
  'relationship',   -- 관계 단계/루트 해금(옵션)
  'participant',    -- 끼어듦/이탈(등장인물) 해금
  'branch',         -- 분기 선택권
  'reset',          -- 되돌리기/리셋
  'premium_mode'    -- 프리미엄 모드
);

-- 1) 유저 지갑(현재 잔액)
create table if not exists public.panana_wallets (
  user_id uuid primary key,
  balance int not null default 0,
  updated_at timestamptz not null default now()
);

-- 2) 원장(모든 증감 기록)
create table if not exists public.panana_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind public.panana_ledger_kind not null,
  delta int not null, -- + 적립 / - 차감
  balance_after int, -- 기록 당시 잔액(옵션: 트리거로 채우는 것을 권장)
  ref_type text not null default '', -- 예: 'unlock', 'purchase'
  ref_id uuid, -- 연결된 row id
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_panana_ledger_user_time on public.panana_ledger(user_id, created_at desc);

-- 3) 해금 가능한 대상(카탈로그)
-- - Deploy 스냅샷에서 생성/갱신되는 것을 권장
create table if not exists public.panana_unlockables (
  id uuid primary key default gen_random_uuid(),
  kind public.panana_unlock_kind not null,
  key text not null unique,          -- 예: 'ch:<slug>:ep:1', 'ch:<slug>:secret:mother', 'ch:<slug>:join:rival'
  title text not null default '',
  description text not null default '',
  character_slug text not null default '', -- 홈 캐릭터 기반 운영을 위해 slug 보관
  cost_panana int not null default 0,      -- 해금 비용(파나나)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_panana_unlockables_character on public.panana_unlockables(character_slug, kind);

-- 4) 유저가 해금한 기록(소유권/권한)
create table if not exists public.panana_user_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  unlockable_key text not null references public.panana_unlockables(key) on delete cascade,
  kind public.panana_unlock_kind not null,
  granted_by text not null default 'purchase', -- purchase/grant
  expires_at timestamptz, -- 기간형이면 설정
  created_at timestamptz not null default now(),
  unique(user_id, unlockable_key)
);

create index if not exists idx_panana_user_unlocks_user on public.panana_user_unlocks(user_id, created_at desc);

-- 5) 프리미엄 패스(기간형)
create table if not exists public.panana_premium_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  pass_key text not null default 'PANA_PASS_01',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_panana_premium_passes_user on public.panana_premium_passes(user_id, expires_at desc);

-- RLS는 운영 정책에 따라 docs/panana-admin/RLS.sql에 추가 권장

