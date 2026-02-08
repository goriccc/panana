-- panana_challenges RLS: deny_all만 있으면 어드민 UI에서 INSERT/UPDATE/DELETE 불가
-- 어드민(panana_admin_users 등록 유저)이 CRUD할 수 있도록 admin_all 정책 추가
-- 실행: Supabase SQL Editor에서 이 파일 실행

drop policy if exists "panana_challenges_deny_all" on public.panana_challenges;
create policy "panana_challenges_admin_all"
on public.panana_challenges for all
using (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true))
with check (exists (select 1 from public.panana_admin_users a where a.user_id = auth.uid() and a.active = true));
