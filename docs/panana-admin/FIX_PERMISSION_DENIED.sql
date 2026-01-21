-- Fix: permission denied (panana_* tables) for authenticated/admin UI
-- 목적: PUBLIC_VIEWS.sql(구버전) 실행 등으로 authenticated 권한이 revoke된 경우를 원복
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

grant usage on schema public to authenticated;

grant select on table public.panana_admin_users to authenticated;

grant select, insert, update, delete on table public.panana_categories to authenticated;
grant select, insert, update, delete on table public.panana_characters to authenticated;
grant select, insert, update, delete on table public.panana_character_categories to authenticated;
grant select, insert, update, delete on table public.panana_home_hero_cards to authenticated;
grant select, insert, update, delete on table public.panana_notices to authenticated;
grant select, insert, update, delete on table public.panana_billing_products to authenticated;
grant select, insert, update, delete on table public.panana_membership_plans to authenticated;
grant select, insert, update, delete on table public.panana_airport_media to authenticated;
grant select, insert, update, delete on table public.panana_airport_thumbnail_sets to authenticated;
grant select, insert, update, delete on table public.panana_airport_copy to authenticated;
grant select, insert, update, delete on table public.panana_site_settings to authenticated;

