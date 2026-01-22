-- Panana Chat Messages (DB chat history)
-- 목적:
-- - panana_users.id(서버 발급 UUID) 기준으로 캐릭터별 대화 메시지를 저장/복원
-- - 다른 기기/브라우저에서도 "이전 대화 이어가기" 가능
--
-- 실행: Supabase SQL Editor에서 실행

create table if not exists public.panana_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.panana_users(id) on delete cascade,
  character_slug text not null,
  client_msg_id text not null,
  from_role text not null check (from_role in ('bot','user','system')),
  text text not null,
  created_at timestamptz not null default now(),
  at_ms bigint
);

-- 중복 업서트 키(클라이언트 메시지 id 기준)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'panana_chat_messages_uniq'
  ) then
    alter table public.panana_chat_messages
      add constraint panana_chat_messages_uniq unique (user_id, character_slug, client_msg_id);
  end if;
end $$;

create index if not exists panana_chat_messages_user_slug_created_at_idx
on public.panana_chat_messages (user_id, character_slug, created_at);

alter table public.panana_chat_messages enable row level security;

-- Security Advisor 대응(deny-all; service_role만 사용)
drop policy if exists "panana_chat_messages_deny_all" on public.panana_chat_messages;
create policy "panana_chat_messages_deny_all"
on public.panana_chat_messages
for all
using (false)
with check (false);

