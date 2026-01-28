-- 인기 캐릭터 집계 Materialized View (최근 30일 / 최근 7일)
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

create materialized view if not exists public.panana_popular_characters_mv
as
select
  character_slug,
  count(*) filter (where created_at >= now() - interval '30 days') as msg_count_30d,
  count(*) filter (where created_at >= now() - interval '7 days') as msg_count_7d,
  count(distinct user_id) filter (where created_at >= now() - interval '30 days') as user_count_30d,
  max(created_at) filter (where created_at >= now() - interval '30 days') as last_at_30d
from public.panana_chat_messages
where created_at >= now() - interval '30 days'
group by character_slug
with no data;

create unique index if not exists panana_popular_characters_mv_slug_idx
on public.panana_popular_characters_mv (character_slug);

-- 최초 1회 채우기
refresh materialized view public.panana_popular_characters_mv;

-- 수동 갱신용 함수 (예: cron에서 호출)
create or replace function public.panana_refresh_popular_characters_mv()
returns void
language sql
set search_path = public
as $$
  refresh materialized view public.panana_popular_characters_mv;
$$;

-- Data API 접근 차단(권장)
revoke all on table public.panana_popular_characters_mv from anon, authenticated;
