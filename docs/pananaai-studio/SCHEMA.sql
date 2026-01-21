-- PananaAI Studio (Supabase/Postgres) Schema Draft
-- 목적: Project > Character(Cast) > Scene 구조 + lorebook/rules/revisions + RBAC

-- 필수 extensions (Supabase 기본 포함되는 경우가 많음)
-- create extension if not exists "pgcrypto";

-- 1) 프로젝트(세계관)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text,
  created_by uuid not null, -- auth.users.id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) 멤버십(RBAC) - Project 단위
create type public.project_role as enum ('owner','admin','editor','author','reviewer','viewer');

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null, -- auth.users.id
  role public.project_role not null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- 3) 캐릭터(등장인물)
create type public.content_status as enum ('draft','review','approved','published','archived');

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slug text not null,
  name text not null,
  role_label text not null default '',
  status public.content_status not null default 'draft',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, slug)
);

-- 4) 씬(드라마 회차/진행 단위)
create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slug text not null,
  episode_label text not null default '',
  title text not null,
  group_chat_enabled boolean not null default true,
  status public.content_status not null default 'draft',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, slug)
);

-- 씬 참여 캐릭터(N:M)
create table if not exists public.scene_participants (
  scene_id uuid not null references public.scenes(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  sort_order int not null default 0,
  primary key (scene_id, character_id)
);

-- 5) Lorebook (Project/Character/Scene 공통 테이블)
create type public.lorebook_scope as enum ('project','character','scene');
create type public.merge_mode as enum ('override','append');
create type public.unlock_type as enum ('public','affection','paid_item');

create table if not exists public.lorebook_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scope public.lorebook_scope not null,
  character_id uuid references public.characters(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete cascade,
  key text not null,
  value text not null default '',
  merge_mode public.merge_mode not null default 'override',
  unlock_type public.unlock_type not null default 'public',
  unlock_affection_min int,
  unlock_sku text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- scope별 무결성: 실제 운영에서는 CHECK constraint 또는 트리거로 강제 권장
-- 예: scope='character'면 character_id not null, scope='scene'면 scene_id not null

-- 6) Trigger Rules (Project/Character/Scene 공통)
create type public.rule_scope as enum ('project','character','scene');

create table if not exists public.trigger_rule_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scope public.rule_scope not null,
  character_id uuid references public.characters(id) on delete cascade,
  scene_id uuid references public.scenes(id) on delete cascade,
  status public.content_status not null default 'draft',
  payload jsonb not null default '{"rules":[]}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7) Prompt (3-Layer) - character 단위
-- 설계 옵션:
-- A) 구조화 테이블로 분리(필드별 컬럼 + few-shot 별도 테이블)
-- B) jsonb로 한번에 저장(초기 빠름, 검색/분석은 어려움)
-- 여기서는 B) jsonb 권장(초기) + 필요 시 A로 확장
create table if not exists public.character_prompts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  status public.content_status not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(character_id)
);

-- 8) 배포(Revisions) - 선택사항(권장)
-- 실제 서비스 반영은 "published_revision_id"를 가리키게 하면 롤백/검수에 유리
create table if not exists public.revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scope text not null, -- 'project'|'character'|'scene'
  ref_id uuid not null, -- 해당 scope의 id
  status public.content_status not null default 'draft',
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

