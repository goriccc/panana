-- Fix: panana_admin_users RLS recursion
-- 목적: AdminAuthGate가 "로딩 중"에 고정되는(무한 재귀/에러) 상황을 방지
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

alter table public.panana_admin_users enable row level security;

drop policy if exists "panana_admin_users_admin_all" on public.panana_admin_users;
drop policy if exists "panana_admin_users_select_self" on public.panana_admin_users;

create policy "panana_admin_users_select_self"
on public.panana_admin_users
for select
using (user_id = auth.uid() and active = true);

