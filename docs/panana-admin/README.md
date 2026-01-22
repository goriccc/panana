# Panana Admin DB 문서

이 폴더는 Panana 서비스 운영(Admin)에서 사용하는 테이블을 Supabase(Postgres)에 생성하기 위한 SQL을 제공합니다.

## 실행 방법(한방)
1. Supabase 대시보드 → SQL Editor
2. `SCHEMA.sql` 전체를 붙여넣고 실행
3. 보안 경고(RLS) 제거 + 운영자만 쓰기 권한 적용:
   - `RLS.sql` 전체를 붙여넣고 실행
   - 관리자 계정 등록:
     - `insert into public.panana_admin_users (user_id) values ('YOUR_AUTH_USER_UUID');`
   - public 읽기까지 전부 막고 “관리자만 읽기/쓰기”로 잠그려면:
     - `RLS_ADMIN_ONLY.sql` 실행(이 경우 서비스 앱에서 직접 SELECT 불가)
   - 위 “관리자만 읽기/쓰기”를 유지하면서 서비스 앱에 노출하려면(권장):
     - `PUBLIC_VIEWS.sql` 실행 → `panana_public_*_v` 뷰만 anon/authenticated 읽기 허용
       - Security Advisor에서 "Security Definer View" 경고가 뜨면, 최신 `PUBLIC_VIEWS.sql`(SECURITY INVOKER 포함)을 다시 실행
       - 만약 `/admin`에서 `permission denied for table panana_*`가 뜨면:
         - `FIX_PRIVILEGES.sql` 실행(관리자=authenticated 권한 복구)
   - `/admin`에서 "로딩 중..."에 고정되면(권장):
     - `RLS_FIX_ADMIN_USERS.sql` 실행 (panana_admin_users RLS 재귀 방지)
4. 공항 썸네일 업로드(스토리지 버킷/정책):
   - `STORAGE.sql` 실행 → `panana-airport` 버킷 생성 + 관리자만 업로드/삭제 + 공개 읽기(썸네일 표시)
4. Security Advisor 경고가 1개 남는 경우(권장):
   - `HARDENING.sql` 전체를 붙여넣고 실행

## 트러블슈팅
- `/admin`에서 `permission denied for table panana_airport_media`가 계속 뜨면:
  - `DIAG_ACCESS.sql` 실행해 상태 확인
  - 바로 복구하려면 `FIX_AIRPORT_MEDIA_ACCESS.sql` 실행
- `/admin`에서 `permission denied for table panana_*`가 계속 뜨면(구버전 PUBLIC_VIEWS 실행 영향 등):
  - `FIX_PERMISSION_DENIED.sql` 실행(관리자=authenticated 권한 복구)

## 공항 썸네일(세트 기반) 적용
- `/admin/airport` 썸네일을 **세트(이미지 필수 + 동영상 선택)**로 쓰려면:
  - `MIGRATE_AIRPORT_THUMBNAIL_SETS.sql` 실행

## (중요) 앱에서 공항 썸네일/문장 안 보일 때
- 증상: `/airport`에서 썸네일/문장이 안 보이거나, debug에서 `permission denied for table panana_airport_media`
- 해결: `FIX_PUBLIC_READ_AIRPORT.sql` 실행 후 `NOTIFY pgrst, 'reload schema';`

## LLM(Claude/Gemini/DeepSeek) 설정
- DB에 **API Key를 저장하지 않고**, Vercel 환경변수(서버 전용)로 관리합니다.
  - 테이블/정책: `LLM_SCHEMA.sql`
  - 환경변수 안내: `LLM_ENV.md`

> 주의: 이 스키마는 Studio 쪽 스키마(`docs/pananaai-studio/SCHEMA.sql`)와 **테이블명이 충돌하지 않도록** `panana_*` prefix를 사용합니다.

## 파나나(크레딧) / 해금(Unlock) 기본 스키마
- 용어: 서비스 내부 통화는 **파나나**(크레딧)로 통일합니다.
- 목표: 씬/비밀/등장인물 끼어듦(1:N)/분기/리셋/프리미엄 모드를 모두 같은 엔진으로 해금/차감합니다.
- 테이블:
  - `PANANA_ECONOMY.sql`: 지갑(`panana_wallets`), 원장(`panana_ledger`), 해금 카탈로그(`panana_unlockables`), 유저 해금(`panana_user_unlocks`), 패스(`panana_premium_passes`)

