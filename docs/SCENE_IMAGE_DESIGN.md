# 장면 이미지 자동 생성 기능 — 전체 프로세스 설계도

> **목표**: 대화 중 유저가 장면을 궁금해할 만한 순간에 자동으로 PuLID/Flux 이미지를 보여준다. 비용 폭탄 방지를 위해 필요할 때만 발동한다.

---

## 1. 전체 흐름도

```
[유저 메시지] ──────────────────────────────────────────────────────────────────┐
                                                                                 │
[챗봇 응답 생성] ──► /api/llm/chat ──► LLM (Claude/Gemini/DeepSeek) ──► text     │
        │                                                                        │
        └──► 1차 규칙 필터 (길이, 키워드) ──► 후보 아님? ──► return { text }      │
        │                                         │                             │
        │                                         ▼                             │
        │                                    후보임                              │
        │                                         │                             │
        │                                         ▼                             │
        └──► 2차 LLM 분류 (경량 모델) ──► "이 장면 이미지로 보여줄 가치 있음?"     │
                    │                         + 영문 프롬프트 생성                │
                    │                                                           │
                    ├── show: false ──► return { text }                         │
                    │                                                           │
                    └── show: true ──► return { text, scenePrompt: "..." }      │
                                            │                                   │
                                            ▼                                   │
[클라이언트] ◄── text 즉시 표시                                               │
                    │                                                           │
                    │  scenePrompt 있음?                                        │
                    │       │                                                   │
                    │       ├── 예 ──► POST /api/scene-image (백그라운드)         │
                    │       │              │                                    │
                    │       │              ├── 쿼터 체크 (유저당 일 N회)          │
                    │       │              ├── Fal.ai flux-pulid 호출            │
                    │       │              └── return { url }                    │
                    │       │                    │                               │
                    │       │                    ▼                               │
                    │       │              [메시지에 이미지 추가/표시]            │
                    │       │                                                    │
                    │       └── 아니오 ──► 종료                                  │
                    │                                                           │
[대화 완료] ◄────────────────────────────────────────────────────────────────────┘
```

---

## 2. 컴포넌트별 상세

### 2.1 1차 규칙 필터 (비용 0)

**위치**: `/api/llm/chat` 내부, LLM 응답 수신 직후

**조건** (하나라도 해당 시 **후보 아님** → LLM 분류 생략):
- 챗봇 응답 길이 < 50자
- 시각적 묘사 키워드 없음: `장소|행동|표정|분위기|창문|카페|비|밤|웃으며|슬프게|봤어|했어|~(하)며`

**구현**: 정규식 또는 `includes()` 체크

```ts
function isSceneCandidate(text: string): boolean {
  if (text.length < 50) return false;
  const keywords = /장소|행동|표정|분위기|창문|카페|비|밤|웃으며|슬프게|봤어|했어|하며/;
  return keywords.test(text);
}
```

---

### 2.2 2차 LLM 분류 (경량 모델)

**위치**: `/api/llm/chat` 내부, 1차 필터 통과 시

**모델**: GPT-4o-mini 또는 Claude Haiku (저렴, 1회당 ~$0.0001)

**입력**:
- `userMessage`: 마지막 유저 메시지
- `assistantMessage`: 챗봇 응답 (방금 생성된 text)

**출력** (JSON):
```json
{
  "show": true,
  "reason": "카페에서 커피 마시며 웃는 풍부한 장면 묘사",
  "enPrompt": "A woman smiling warmly while drinking coffee in a cozy cafe, soft lighting, candid moment, cinematic, 4k"
}
```

**시스템 프롬프트**:
```
당신은 대화 장면을 이미지로 보여줄지 판단하는 분류기입니다.
[유저] {userMessage}
[챗봇] {assistantMessage}

챗봇 응답이 시각적으로 풍부한 장면(장소, 행동, 표정, 분위기)을 묘사하고, 
유저가 "이 모습이 궁금하겠다"고 느낄 만한가요?

다음 JSON만 출력하세요 (다른 텍스트 금지):
{"show": true|false, "reason": "한 줄 이유", "enPrompt": "show가 true일 때만, Flux 이미지 생성용 영어 프롬프트 (캐릭터 생김새/장면/분위기/퀄리티 키워드 포함)"}
```

---

### 2.3 /api/llm/chat 응답 확장

**기존**:
```json
{
  "ok": true,
  "text": "...",
  "runtime": {...},
  "events": [...]
}
```

**확장** (scenePrompt 있을 때만):
```json
{
  "ok": true,
  "text": "...",
  "scenePrompt": "A woman smiling warmly in a cozy cafe...",
  "runtime": {...},
  "events": [...]
}
```

**조건**:
- `characterSlug` 존재 (캐릭터 없으면 참조 이미지 없음)
- `characterAvatarUrl` (프로필 이미지) 존재
- 1차 필터 통과 + 2차 LLM `show: true`

---

### 2.4 /api/scene-image (신규 API)

**Method**: POST

**Request Body**:
```json
{
  "pananaId": "uuid",        // 쿼터 체크용
  "characterSlug": "seola",
  "enPrompt": "A woman smiling warmly in a cozy cafe..."
}
```

**처리 흐름**:
1. `pananaId`로 일일 쿼터 체크 (기본 5회/일)
2. `characterSlug`로 캐릭터 프로필 이미지 URL 조회
3. Fal.ai `fal-ai/flux-pulid` 호출
   - `reference_image_url`: 캐릭터 프로필 이미지
   - `prompt`: enPrompt
   - `image_size`: `portrait_4_3` (채팅 UI에 적합)
4. 응답 이미지 URL 반환

**Response**:
```json
{
  "ok": true,
  "url": "https://fal.media/files/...",
  "quotaRemaining": 4
}
```

**에러**:
- 쿼터 초과: `{ ok: false, error: "오늘 장면 생성 횟수를 모두 사용했어요." }`
- 캐릭터/이미지 없음: `{ ok: false, error: "..." }`
- Fal.ai 실패: `{ ok: false, error: "..." }`

---

### 2.5 쿼터 저장

**옵션 A**: Supabase 테이블
```sql
CREATE TABLE scene_image_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panana_id uuid NOT NULL REFERENCES panana_users(id),
  used_at date NOT NULL DEFAULT CURRENT_DATE,
  count int NOT NULL DEFAULT 0,
  UNIQUE(panana_id, used_at)
);
```

**옵션 B**: 단순 구현 — `panana_scene_image_log` 로그 테이블
```sql
CREATE TABLE panana_scene_image_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panana_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- 일일 카운트: SELECT count(*) WHERE panana_id=? AND created_at >= CURRENT_DATE
```

---

### 2.6 클라이언트 (chat/ui.tsx)

**메시지 타입 확장**:
```ts
type Msg = {
  id: string;
  from: "bot" | "user" | "system";
  text: string;
  sceneImageUrl?: string;  // 신규
  sceneImageLoading?: boolean;  // 신규
};
```

**send() 내 응답 처리**:
```ts
const reply = String(data.text || "").trim();
const scenePrompt = data.scenePrompt;

// 1. 텍스트 즉시 표시
setMessages(prev => [...prev, { id: botId, from: "bot", text: reply }]);

// 2. scenePrompt 있으면 백그라운드 이미지 생성
if (scenePrompt && characterAvatarUrl) {
  // 먼저 로딩 플래그로 메시지 추가
  setMessages(prev => prev.map(m =>
    m.id === botId ? { ...m, sceneImageLoading: true } : m
  ));

  fetch("/api/scene-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pananaId: getPananaId(),
      characterSlug,
      enPrompt: scenePrompt,
    }),
  })
    .then(r => r.json())
    .then(data => {
      if (data?.ok && data?.url) {
        setMessages(prev => prev.map(m =>
          m.id === botId
            ? { ...m, sceneImageUrl: data.url, sceneImageLoading: false }
            : m
        ));
      } else {
        setMessages(prev => prev.map(m =>
          m.id === botId ? { ...m, sceneImageLoading: false } : m
        ));
      }
    })
    .catch(() => {
      setMessages(prev => prev.map(m =>
        m.id === botId ? { ...m, sceneImageLoading: false } : m
      ));
    });
}
```

**Bubble 컴포넌트**:
- `sceneImageUrl` 있으면 메시지 아래에 이미지 표시
- `sceneImageLoading`이면 스켈레톤/로딩 UI

---

### 2.7 채팅 히스토리 저장

**확장** (`/api/me/chat-messages`):
- `sceneImageUrl` 필드 추가 (optional)
- 로컬 `saveChatHistory` / `loadChatHistory`: `sceneImageUrl` 포함

**DB 메시지 스키마** (이미 있다면):
- `text`, `from`, `at` 외에 `scene_image_url` 컬럼 추가 (nullable)

---

## 3. 환경 변수

| 변수 | 용도 |
|------|------|
| `FAL_KEY` | Fal.ai API 키 |
| `OPENAI_API_KEY` (또는 기존 LLM) | 2차 분류용 GPT-4o-mini (또는 Anthropic/Gemini) |

---

## 4. 비용 추정 (1회 장면 생성)

| 단계 | 비용 |
|------|------|
| 1차 규칙 필터 | $0 |
| 2차 LLM 분류 (GPT-4o-mini) | ~$0.0001 |
| Fal.ai flux-pulid | ~$0.02 |
| **총** | **~$0.02/회** |

**쿼터 5회/일/유저** → 최대 ~$0.1/유저/일

---

## 5. 구현 순서

| 단계 | 작업 | 비고 |
|------|------|------|
| 1 | `scene_image_usage` 또는 로그 테이블 생성 | DB 마이그레이션 |
| 2 | `/api/scene-image` 라우트 구현 | Fal.ai 연동, 쿼터 체크 |
| 3 | `/api/llm/chat`에 1차 규칙 필터 + 2차 LLM 분류 추가 | scenePrompt 반환 |
| 4 | `chat/ui.tsx` 메시지 타입 확장 + scene-image 호출 + 이미지 표시 | Bubble 수정 |
| 5 | `chat-messages` API + 로컬 히스토리에 sceneImageUrl 저장 | 선택 |

---

## 6. 기존 기능 영향

- **채팅 API**: 응답에 `scenePrompt` 필드 추가 (선택적)
- **메시지 구조**: `sceneImageUrl`, `sceneImageLoading` 추가
- **DB**: scene_image 로그/쿼터 테이블 신규
- **기타**: 기존 채팅 흐름 변경 없음, 실패 시 텍스트만 표시

---

## 7. 확인 체크리스트

- [ ] 1차 규칙 필터 조건 적절한가?
- [ ] 2차 LLM 모델 (GPT-4o-mini vs Claude Haiku) 선택
- [ ] 일일 쿼터 기본값 (5회) 확정
- [ ] 캐릭터 프로필 이미지 없을 때 처리 (생략)
- [ ] Fal.ai `FAL_KEY` 환경 변수 설정
- [ ] 채팅 히스토리 DB에 scene_image_url 저장 여부

---

**컨펌 후 구현 진행**

---

## 8. 구현 완료 (2025-01)

- [x] `docs/panana-admin/ADD_SCENE_IMAGE_SETTINGS.sql` — DB 마이그레이션
- [x] `POST /api/scene-image` — Fal.ai flux-pulid 연동, 쿼터 체크
- [x] `POST /api/llm/chat` — 1차 규칙 필터 + 2차 LLM 분류(Claude Haiku) + scenePrompt 반환
- [x] `chat/ui.tsx` — 메시지 타입 확장, 장면 이미지 표시, scene-image 백그라운드 호출
- [x] `admin/site/page.tsx` — 장면 이미지 설정 (활성화, 일일 상한)

**환경 변수**: `.env.local`에 `FAL_KEY` 추가 필요 (fal.ai API 키)
