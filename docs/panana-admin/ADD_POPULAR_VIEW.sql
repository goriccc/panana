-- 인기 캐릭터 집계 뷰(최근 30일 / 최근 7일)
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

create or replace view public.panana_popular_characters_v
with (security_barrier=true, security_invoker=true)
as
select
  character_slug,
  count(*) filter (where created_at >= now() - interval '30 days') as msg_count_30d,
  count(*) filter (where created_at >= now() - interval '7 days') as msg_count_7d,
  count(distinct user_id) filter (where created_at >= now() - interval '30 days') as user_count_30d,
  max(created_at) filter (where created_at >= now() - interval '30 days') as last_at_30d
from public.panana_chat_messages
where created_at >= now() - interval '30 days'
group by character_slug;

-- 주의: 이 뷰는 서비스(role)에서만 접근하도록 두는 것을 권장합니다.
