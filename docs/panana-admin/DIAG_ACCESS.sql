-- Panana Admin Diagnostics: permission denied 원인 확인용
-- 실행: Supabase SQL Editor에서 실행 후 결과를 확인하세요.

-- 1) 관리자 allowlist에 UID가 있는지(여기서 true여야 admin 정책 통과 가능)
-- 예: select * from public.panana_admin_users where user_id = '16949fce-fcfc-4595-932b-cb160af022ae';

-- 2) RLS 활성 여부
select
  c.relname as table,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('panana_admin_users','panana_airport_media');

-- 3) panana_airport_media 정책 목록
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('panana_admin_users','panana_airport_media')
order by tablename, policyname;

-- 4) authenticated role이 테이블 권한을 갖는지(Privilege)
select
  has_table_privilege('authenticated', 'public.panana_airport_media', 'select') as auth_select,
  has_table_privilege('authenticated', 'public.panana_airport_media', 'insert') as auth_insert,
  has_table_privilege('authenticated', 'public.panana_airport_media', 'update') as auth_update,
  has_table_privilege('authenticated', 'public.panana_airport_media', 'delete') as auth_delete;

