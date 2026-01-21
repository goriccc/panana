# Supabase RLS 정책 초안(권장)

## 목표
- 모든 리소스는 **project_id 스코프**로 접근을 강제
- `project_members`의 role에 따라 **조회/편집/삭제/승인/배포**를 제한

> 아래 SQL은 “정책 방향” 예시입니다. 실제 서비스 정책(배포 권한, 승인 권한)에 맞춰 조정하세요.

---

## 0) 전제
- Supabase Auth 사용: `auth.uid()`가 현재 사용자 id
- `project_members(project_id, user_id, role)`이 권한의 기준

### 역할 그룹(권장)
- **read**: viewer 이상
- **write**: author/editor/admin/owner
- **admin**: admin/owner
- **review**: reviewer/admin/owner

---

## 1) Helper View(권장)
정책을 단순화하기 위해 role 체크를 view로 노출:

```sql
create or replace view public.v_project_role as
select
  pm.project_id,
  pm.user_id,
  pm.role
from public.project_members pm;
```

---

## 2) 기본 패턴
### (A) SELECT: 프로젝트 멤버면 허용
```sql
exists (
  select 1 from public.project_members pm
  where pm.project_id = <table>.project_id
    and pm.user_id = auth.uid()
)
```

### (B) INSERT/UPDATE: write role 이상만
```sql
exists (
  select 1 from public.project_members pm
  where pm.project_id = <table>.project_id
    and pm.user_id = auth.uid()
    and pm.role in ('owner','admin','editor','author')
)
```

### (C) DELETE: admin role 이상만(권장)
```sql
exists (
  select 1 from public.project_members pm
  where pm.project_id = <table>.project_id
    and pm.user_id = auth.uid()
    and pm.role in ('owner','admin')
)
```

---

## 3) 테이블별 권장 RLS(예시)

### projects
- 읽기: `project_members`로 스코프
- 생성: 로그인 사용자(creator) 허용 + 생성과 동시에 owner 멤버 추가(서버/edge function 권장)

```sql
alter table public.projects enable row level security;

create policy "projects_select_member"
on public.projects for select
using (
  exists (select 1 from public.project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid())
);
```

### project_members
- 읽기: 프로젝트 멤버면 조회 가능
- 쓰기: owner만(권장)

```sql
alter table public.project_members enable row level security;

create policy "members_select_member"
on public.project_members for select
using (
  exists (select 1 from public.project_members pm where pm.project_id = project_members.project_id and pm.user_id = auth.uid())
);

create policy "members_write_owner_only"
on public.project_members for all
using (
  exists (select 1 from public.project_members pm
          where pm.project_id = project_members.project_id
            and pm.user_id = auth.uid()
            and pm.role = 'owner')
)
with check (
  exists (select 1 from public.project_members pm
          where pm.project_id = project_members.project_id
            and pm.user_id = auth.uid()
            and pm.role = 'owner')
);
```

### characters / scenes / lorebook_entries / trigger_rule_sets / character_prompts
공통 패턴: project_id 스코프 기반

```sql
alter table public.characters enable row level security;
create policy "characters_select_member" on public.characters for select
using (exists (select 1 from public.project_members pm where pm.project_id = characters.project_id and pm.user_id = auth.uid()));

create policy "characters_write_writer" on public.characters for insert
with check (exists (select 1 from public.project_members pm where pm.project_id = characters.project_id and pm.user_id = auth.uid()
  and pm.role in ('owner','admin','editor','author')));

create policy "characters_update_writer" on public.characters for update
using (exists (select 1 from public.project_members pm where pm.project_id = characters.project_id and pm.user_id = auth.uid()
  and pm.role in ('owner','admin','editor','author')));
```

> scenes/lorebook_entries/trigger_rule_sets/character_prompts도 동일 패턴으로 적용하면 됩니다.

---

## 4) 배포 권한(권장)
Published로 상태 변경(또는 revisions publish)은 **admin/owner**로 제한 권장.

방법:
- UPDATE 정책에서 `status='published'` 변경은 별도 정책/함수로 제한
- 또는 `publish_*`를 Edge Function으로 제공하고 DB는 직접 publish 불가

---

## 5) 외부 작가(Author) 운영 팁
- Author는 Draft/Review까지만 업데이트 가능
- Approved/Published는 Reviewer/Admin만 가능
- 이 제약은 UI뿐 아니라 **DB 정책(또는 서버 함수)**로 강제 권장

