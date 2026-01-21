-- Panana Admin Hardening (Supabase Security Advisor 경고 제거용)
-- 목적: 남는 경고 1개(대부분 "Function search_path mutable" / "public 함수 노출") 해결
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행

-- 1) 트리거 함수 search_path 고정 (Security Advisor: Function Search Path Mutable 대응)
alter function public.panana_touch_updated_at() set search_path = public;

-- 2) public 스키마 함수 RPC 호출 차단(anon/authenticated에서 execute 제거)
-- 트리거 실행에는 영향 없음(테이블 소유자 권한으로 실행)
revoke execute on function public.panana_touch_updated_at() from anon, authenticated;

