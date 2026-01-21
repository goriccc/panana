# PananaAI Studio 문서

이 폴더는 PananaAI Studio(제작자 콘솔)의 운영/보안/DB 설계 문서를 모아둡니다.

## 문서 목록
- `RBAC.md`: 역할/권한(RBAC) 권장안
- `ACCESS_MATRIX.md`: 권한별 화면 접근 매트릭스(페이지 단위)
- `WORKFLOWS.md`: 역할별 하루 작업 시나리오(운영 절차)
- `SCHEMA.sql`: Supabase(Postgres) 테이블 DDL 초안
- `RLS.md`: Supabase RLS 정책(권장) 초안

## 기본 컨셉
- **Project**(세계관/작품) > **Cast/Character**(등장인물) > **Scene**(회차/씬)
- 합성 우선순위(권장): **Scene > Character > Project**
- mergeMode(권장): 기본 `override`, 일부 키만 `append`

