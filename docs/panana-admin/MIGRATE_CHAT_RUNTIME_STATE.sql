-- Chat Runtime State (variables/participants persist)
-- 목적:
-- - 채팅 중 변수 상태(affection/risk 등)를 사용자별/캐릭터별로 저장
-- - 다음 턴에 이어서 트리거 평가/템플릿 치환에 사용

create table if not exists public.panana_chat_runtime_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_slug text not null,
  variables jsonb not null default '{}'::jsonb,
  participants text[] not null default '{}'::text[],
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, character_slug)
);

drop trigger if exists panana_chat_runtime_states_touch on public.panana_chat_runtime_states;
create trigger panana_chat_runtime_states_touch
before update on public.panana_chat_runtime_states
for each row execute function public.panana_touch_updated_at();

alter table public.panana_chat_runtime_states enable row level security;

drop policy if exists "panana_chat_runtime_states_select_own" on public.panana_chat_runtime_states;
create policy "panana_chat_runtime_states_select_own"
on public.panana_chat_runtime_states
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "panana_chat_runtime_states_upsert_own" on public.panana_chat_runtime_states;
create policy "panana_chat_runtime_states_upsert_own"
on public.panana_chat_runtime_states
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "panana_chat_runtime_states_update_own" on public.panana_chat_runtime_states;
create policy "panana_chat_runtime_states_update_own"
on public.panana_chat_runtime_states
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

