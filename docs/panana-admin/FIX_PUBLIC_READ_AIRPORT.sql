-- Fix: Public read for Airport thumbnails/copy (for app runtime)
-- 증상:
-- - panana_public_airport_thumbnail_sets_v => 200 이지만 0 rows (RLS로 숨김)
-- - panana_public_airport_media_v => permission denied for table panana_airport_media (base privilege 부족)
--
-- 목적:
-- - 앱(anon key)에서 공항 썸네일/문장 데이터를 읽을 수 있게 최소 권한/정책 부여
-- - Admin 쓰기 정책은 기존대로 유지
--
-- 실행: Supabase SQL Editor에서 이 파일 전체 실행 후, 아래도 실행 권장:
--   NOTIFY pgrst, 'reload schema';

-- 1) privileges (security_invoker view 사용 시 base table privilege 필요)
grant usage on schema public to anon, authenticated;

grant select on table public.panana_airport_thumbnail_sets to anon, authenticated;
grant select on table public.panana_airport_media to anon, authenticated;
grant select on table public.panana_airport_copy to anon, authenticated;

-- 2) RLS enable (이미 enable 되어있어도 OK)
alter table public.panana_airport_thumbnail_sets enable row level security;
alter table public.panana_airport_media enable row level security;
alter table public.panana_airport_copy enable row level security;

-- 3) Public read policies (active=true만)
drop policy if exists "panana_airport_thumbnail_sets_public_read" on public.panana_airport_thumbnail_sets;
create policy "panana_airport_thumbnail_sets_public_read"
on public.panana_airport_thumbnail_sets
for select
using (active = true);

drop policy if exists "panana_airport_media_public_read" on public.panana_airport_media;
create policy "panana_airport_media_public_read"
on public.panana_airport_media
for select
using (active = true);

drop policy if exists "panana_airport_copy_public_read" on public.panana_airport_copy;
create policy "panana_airport_copy_public_read"
on public.panana_airport_copy
for select
using (active = true);

