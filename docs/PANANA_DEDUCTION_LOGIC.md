# 충전된 파나나(P) 차감 로직 — 텍스트 대화 / 음성 대화

## 요약

- **정의된 스펙**: `src/lib/billing/constants.ts`, `computeP.ts`, `BillingEngine.ts`에 **텍스트 1턴당 P**, **음성 1초당 P**, 구독 할인 규칙이 정의되어 있음.
- **실제 적용 상태**:  
  **텍스트 대화**는 현재 **P 차감/잔액 갱신이 전혀 이루어지지 않음**.  
  **음성**은 **맛보기 30초 한도**와 **실시간 통화 유료 전용**만 적용되고, **P 차감은 없음**.

---

## 1. 정의만 되어 있는 차감 규칙

### 1) 텍스트 대화 (채팅 1턴당 P)

| 구분 | 모델 | 비구독 P/턴 | 구독 P/턴 |
|------|------|-------------|-----------|
| Normal Standard | Claude Haiku | 20 | 20 |
| Normal Deep | Claude Sonnet | 60 | **48** (20% 할인) |
| NSFW Standard | Gemini Flash | 10 | 10 |
| NSFW Deep | Gemini Pro | 40 | **32** (20% 할인) |

- 출처: `src/lib/billing/constants.ts` (`P_PER_TURN`, `SUBSCRIPTION_DEEP_P_PER_TURN`, `SUBSCRIPTION_NSFW_DEEP_P_PER_TURN`)
- 계산 함수: `src/lib/billing/computeP.ts` → `getChatPForTurn(modelId, isSubscriber, mode)`

### 2) 음성 (1초당 P)

| 구분 | 비구독 | 구독 |
|------|--------|------|
| P/초 | 10 | **5** (50% 할인) |

- 출처: `src/lib/billing/constants.ts` (`P_PER_VOICE_SECOND`, `SUBSCRIPTION_VOICE_DISCOUNT_RATIO`)
- 계산 함수: `src/lib/billing/computeP.ts` → `getVoicePPerSecond(isSubscriber)`

### 3) 지갑 구조

- 잔액: `panana_billing_profiles` 의 `panana_balance` = `amount_base` + `amount_bonus`
- **소비 순서**: 보너스(`amount_bonus`) 먼저 차감, 그다음 충전분(`amount_base`) — `src/lib/billing/types.ts` 등에 명시

---

## 2. 실제로 어디에 적용되어 있는지

### 텍스트 대화

- **API**: `src/app/api/llm/chat/route.ts`
- **동작**: 메시지 받아서 LLM 호출 후 응답만 반환.  
  **잔액 조회·차감, `panana_billing_transactions`(type: usage), `panana_usage_logs` 기록 없음.**
- **BillingEngine**: `src/lib/billing/BillingEngine.ts`는 **인터페이스만** 있고,  
  `computeChatDeduction` / `deductChat` 를 호출하는 **구현체·연동 코드가 없음**.

→ 따라서 **충전된 파나나에 대한 텍스트 대화 P 차감 로직은 현재 적용되어 있지 않음.**

### 음성

1. **맛보기(무료) 음성**
   - **API**: `src/app/api/me/voice-usage/route.ts`
   - **동작**: 당일 사용 초만 `panana_voice_usage` 에 누적.  
     **P 차감 없음.**  
     일 30초 초과 시 409로 차단 (`TRIAL_VOICE_MAX_SECONDS_PER_DAY`).

2. **실시간 음성(Grok 등)**
   - **API**: `src/app/api/voice/grok-ephemeral-token/route.ts`
   - **동작**: `has_ever_paid` / 구독 여부만 확인.  
     맛보기 전용이면 403.  
     **P 차감·사용량 기록 없음.**

→ **음성도 “충전된 파나나를 1초당 N P씩 차감”하는 로직은 현재 적용되어 있지 않음.**

---

## 3. 차감을 실제로 적용하려면 필요한 작업

1. **BillingEngine 구현**
   - `getProfile`, `computeChatDeduction`, `deductChat`, `computeVoiceDeduction`, `deductVoice` 등 구현.
   - `panana_billing_profiles` 잔액 갱신 + `panana_billing_transactions` (type: `usage`) + (선택) `panana_usage_logs` 기록.

2. **텍스트 대화**
   - `src/app/api/llm/chat/route.ts` 에서:
     - 요청 시 또는 응답 후 **한 턴** 기준으로 `computeChatDeduction` → `deductChat` 호출.
     - 잔액 부족 시 거부 또는 “한 턴 허용 후 충전 유도” 등 정책에 맞게 처리.

3. **음성**
   - 실시간 음성: 통화 종료 시 또는 5초 단위로 사용 초 합산 후 `getVoicePPerSecond` × 초 → `deductVoice` 호출.
   - (선택) 스트리밍 음성 API가 있으면, 동일하게 “N초 사용 = N × P” 계산 후 차감.

---

## 4. 참고 파일

| 용도 | 파일 |
|------|------|
| P/턴, P/초, 구독 할인 상수 | `src/lib/billing/constants.ts` |
| 턴/초당 P 계산 함수 | `src/lib/billing/computeP.ts` |
| 차감·프로필·트랜잭션 인터페이스 | `src/lib/billing/BillingEngine.ts` |
| 채팅 API (현재 차감 없음) | `src/app/api/llm/chat/route.ts` |
| 맛보기 음성 사용량만 기록 | `src/app/api/me/voice-usage/route.ts` |
| 실시간 음성 유료 전용 게이트 | `src/app/api/voice/grok-ephemeral-token/route.ts` |
