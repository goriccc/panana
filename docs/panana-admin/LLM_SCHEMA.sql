-- Panana Admin - LLM Settings (NO API KEYS IN DB)
-- 목적:
-- - Claude/Gemini/DeepSeek 등 LLM 호출에 필요한 "튜닝 값"을 Admin에서 관리
-- - API Key는 DB에 저장하지 않고, Vercel 환경변수(서버 전용)로만 관리
--
-- 실행 순서:
-- 1) docs/panana-admin/SCHEMA.sql
-- 2) docs/panana-admin/RLS.sql (또는 RLS_ADMIN_ONLY.sql)
-- 3) 이 파일 실행
-- 4) (권장) NOTIFY pgrst, 'reload schema';

-- 1) Provider enum
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'panana_llm_provider'
  ) then
    create type public.panana_llm_provider as enum ('anthropic', 'gemini', 'deepseek');
  end if;
end $$;

-- 2) LLM 설정 테이블 (키 저장 금지)
create table if not exists public.panana_llm_settings (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global', -- 현재는 global만 사용(향후 project/character 단위 확장 가능)
  provider public.panana_llm_provider not null,
  model text not null default '',
  temperature numeric not null default 0.7,
  max_tokens int not null default 1024,
  top_p numeric not null default 1.0,
  -- 운영 옵션(비밀 아님)
  force_parenthesis boolean not null default false,
  nsfw_filter boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scope, provider)
);

drop trigger if exists panana_llm_settings_touch on public.panana_llm_settings;
create trigger panana_llm_settings_touch
before update on public.panana_llm_settings
for each row execute function public.panana_touch_updated_at();

create index if not exists idx_panana_llm_settings_scope on public.panana_llm_settings(scope, provider);

-- Seed(선택): 3 provider 기본 설정
insert into public.panana_llm_settings (scope, provider, model, temperature, max_tokens, top_p, force_parenthesis, nsfw_filter)
values
  ('global', 'anthropic', 'Claude 4.5Sonnet', 0.7, 1024, 1.0, false, true),
  ('global', 'gemini', 'Gemini 2.5Pro', 0.7, 1024, 1.0, false, true),
  ('global', 'deepseek', 'DeepSeek V3', 0.7, 1024, 1.0, false, true)
on conflict (scope, provider) do nothing;

-- 3) 권한 + RLS
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.panana_llm_settings to authenticated;

alter table public.panana_llm_settings enable row level security;

-- 앱(anon)에서 읽어도 되는 값만 들어있지만, 기본은 admin 전용으로 두고
-- 서버(/api/llm/chat)가 필요하면 service role 또는 별도 view로 제공하는 게 안전합니다.
-- 여기서는 "공개 읽기"도 제공(튜닝값이 민감하지 않다는 전제).
grant select on table public.panana_llm_settings to anon;

drop policy if exists "panana_llm_settings_public_read" on public.panana_llm_settings;
create policy "panana_llm_settings_public_read"
on public.panana_llm_settings
for select
using (true);

drop policy if exists "panana_llm_settings_admin_all" on public.panana_llm_settings;
create policy "panana_llm_settings_admin_all"
on public.panana_llm_settings
for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));

