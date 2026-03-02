-- 찾기 메뉴 추천 검색어(빨간박스) 어드민 설정용
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_site_settings
  add column if not exists recommended_search_tags jsonb not null default '["#현실연애","#롤플주의","#고백도전","#연애감정","#환승연애"]'::jsonb;

-- 기존 레코드 기본값 보정
update public.panana_site_settings
set recommended_search_tags = coalesce(recommended_search_tags, '["#현실연애","#롤플주의","#고백도전","#연애감정","#환승연애"]'::jsonb)
where recommended_search_tags is null or recommended_search_tags = 'null'::jsonb;

-- panana_public_site_settings_v 뷰에 recommended_search_tags 추가는 PUBLIC_VIEWS.sql 에서 반영하세요.
