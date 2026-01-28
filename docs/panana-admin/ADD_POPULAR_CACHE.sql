-- panana_popular_cache: 인기 캐릭터 캐시 테이블
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

create table if not exists public.panana_popular_cache (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_panana_popular_cache_key_updated
on public.panana_popular_cache (key, updated_at desc);

drop trigger if exists panana_popular_cache_touch on public.panana_popular_cache;
create trigger panana_popular_cache_touch
before update on public.panana_popular_cache
for each row execute function public.panana_touch_updated_at();

alter table public.panana_popular_cache enable row level security;

-- Security Advisor 대응: 직접 접근 차단(service_role만 사용)
drop policy if exists "panana_popular_cache_deny_all" on public.panana_popular_cache;
create policy "panana_popular_cache_deny_all"
on public.panana_popular_cache
for all
using (false)
with check (false);
