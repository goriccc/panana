-- Fix: permission denied for panana_* tables
-- 원인: PUBLIC_VIEWS.sql에서 authenticated에 대해 revoke all을 수행하면
--       로그인 유저(=authenticated role)도 panana_* 테이블 접근이 막혀 permission denied가 발생함.
--
-- 해결: authenticated에 필요한 테이블 권한을 다시 부여하고, 접근 통제는 RLS로만 처리.
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.panana_categories to authenticated;
grant select, insert, update, delete on table public.panana_characters to authenticated;
grant select, insert, update, delete on table public.panana_character_categories to authenticated;
grant select, insert, update, delete on table public.panana_character_posts to authenticated;
grant select, insert, update, delete on table public.panana_home_hero_cards to authenticated;
grant select, insert, update, delete on table public.panana_notices to authenticated;
grant select, insert, update, delete on table public.panana_billing_products to authenticated;
grant select, insert, update, delete on table public.panana_membership_plans to authenticated;
grant select, insert, update, delete on table public.panana_airport_media to authenticated;
grant select, insert, update, delete on table public.panana_airport_copy to authenticated;
grant select, insert, update, delete on table public.panana_site_settings to authenticated;

