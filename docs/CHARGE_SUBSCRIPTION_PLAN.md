# 충전형·구독형 구현 계획 (Charge + Subscription)

첨부 스펙(최종 확정 수익 구조 + 충전형 구독형) 기준 개발 플랜입니다.

---

## 1. 현재 상태 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| **충전 상품** | ✅ DB + 결제 연동 | `panana_billing_products`, `/api/payment/confirm`. 상품명/가격은 스펙과 동일하게 맞출 수 있음 |
| **1:1 + 보너스 P** | ✅ | amount_base / amount_bonus, 보너스 선차감 |
| **모델별 P 차감** | ✅ 상수 정의 | 20/60/10/40 P, 음성 10 P/초 (constants.ts) |
| **구독자 심층 20% 할인** | ✅ 상수 정의 | SUBSCRIPTION_DEEP_P_PER_TURN=48, NSFW Deep=32 |
| **구독 가입 시 즉시 P 지급** | ❌ 미구현 | subscribe API는 `is_subscriber`만 설정, **15,000 P 미지급** |
| **구독자 매일 500 P** | ❌ 미구현 | `addDailyBonus` 인터페이스만 존재, **실제 지급 로직/스케줄 없음** |
| **최대 발행 30,000 P/월** | ❌ 미정의 | 일 500 P × 30일 + 즉시 15,000 P = 30,000 P 캡 정책 미반영 |

---

## 2. 스펙 정리 (첨부 이미지 기준)

### 2.1 충전 상품 (1:1 + 보너스)

| 상품명 | 판매가 | 기본(P) | 보너스(P) | 합계(P) |
|--------|--------|---------|-----------|---------|
| 설레는 첫걸음 | 2,900원 | 2,900 | 100 | 3,000 |
| 가까워지는 우리 | 5,900원 | 5,900 | 600 | 6,500 |
| 깊어지는 대화 | 12,900원 | 12,900 | 2,100 | 15,000 |
| 둘만의 비밀 | 29,000원 | 29,000 | 6,000 | 35,000 |
| 끝없는 판타지 | 49,000원 | 49,000 | 11,000 | 60,000 |
| 파나나 킹덤 | 99,000원 | 99,000 | 21,000 | 120,000 |

- DB `panana_billing_products`: sku, title, pana_amount, bonus_amount, price_krw 등으로 위와 동일하게 등록/동기화.

### 2.2 모델별 차감 (마진 80% 유지)

- 일반 표준: 20 P (Claude Haiku)
- 일반 심층: 60 P → **구독 20% 할인 시 48 P** (Claude Sonnet)
- 19금 표준: 10 P (Gemini Flash)
- 19금 심층: 40 P → **구독 20% 할인 시 32 P** (Gemini Pro)
- 음성: 10 P/초 (구독 50% 할인 시 5 P/초)

→ 이미 `src/lib/billing/constants.ts`에 반영됨. 채팅/음성 호출부에서 구독 여부에 따라 적용만 확인.

### 2.3 파나나 패스 (구독)

- **구독료**: 월 14,900원
- **즉시 지급**: 15,000 P (기본 14,900 + 보너스 100)
- **매일 지급**: 500 P (출석/로그인 기준 등 정책 확정 필요)
- **월 최대 발행**: 30,000 P (즉시 15,000 + 500×30일)

---

## 3. 개발 플랜 (우선순위)

### Phase 1: 구독 가입 시 즉시 15,000 P 지급

**목표**: 멤버십 결제 확정 시 “충전형 구독”처럼 즉시 15,000 P를 지갑에 넣기.

1. **DB**
   - `panana_billing_profiles`: 이미 `amount_base`/`amount_bonus`/`panana_balance` 있음. 구독 즉시 P는 “보너스”로 넣을지, 기본으로 넣을지 정책 결정 (스펙상 기본 14,900 + 보너스 100 → 14,900 base + 100 bonus 반영 가능).
2. **API**
   - `POST /api/membership/subscribe`: 결제 검증 후
     - `is_subscriber`, `subscription_type` 설정 (기존 유지)
     - **추가**: 해당 유저에게 15,000 P 적립 (내부 정책에 따라 amount_base + amount_bonus 분할, 예: 14,900 + 100).
     - `panana_billing_transactions`에 type `recharge` 또는 `bonus`로 기록 (설명에 “파나나 패스 가입 즉시 지급” 등).
3. **상수**
   - `PANANA_PASS_UPFRONT_P = 15_000`, `PANANA_PASS_UPFRONT_BASE_P = 14_900`, `PANANA_PASS_UPFRONT_BONUS_P = 100` 등 constants에 정의 후 subscribe에서 참조.

**산출물**: 구독 완료 시 잔액에 15,000 P 반영, 트랜잭션/명세 일관.

---

### Phase 2: 구독자 매일 500 P 지급

**목표**: “매일 500 P 추가 증정”을 자동 지급.

1. **정책 확정**
   - **지급 기준**: “매일 1회”를 “자정(UTC/KST) 기준 일별”로 할지, “로그인/출석”으로 할지 결정.
   - **캡**: 월 최대 30,000 P (즉시 15,000 + 500×30) → “해당 월에 이미 15,000 + (500×N)만큼 지급했으면 30,000 초과 분은 안 준다” 규칙 필요.
2. **DB**
   - 구독자 일별 지급 이력 저장용 테이블 또는 컬럼 필요.
     - 예: `panana_subscription_daily_grants (user_id, grant_date date, amount_p, created_at)` 또는
     - `panana_billing_transactions`만 사용하고 type=`bonus`, description에 날짜/“일일보너스” 포함해 “당일 이미 지급” 여부 조회.
   - “이번 달 구독으로 받은 총 P”를 셀 수 있으면 30,000 캡 적용 가능.
3. **실행 주체**
   - **옵션 A (권장)**: Vercel Cron (또는 외부 스케줄러)로 매일 1회 실행되는 API 예) `GET/POST /api/cron/subscription-daily-bonus` (인증: CRON_SECRET 등).
   - **옵션 B**: 로그인/출석 시점에 “오늘 일일보너스 받았는지” 확인 후 미수령이면 지급 (실제 “출석” 기준이면 이쪽이 적합).
4. **로직**
   - 당일(또는 전일 자정 기준) “해당 유저 구독 일일 지급” 1회 여부 확인.
   - 해당 월 구독 지급 합계가 15,000 + 500×30 미만이면 500 P 지급 (amount_bonus 우선 권장).
   - `panana_billing_profiles` 잔액 갱신 + `panana_billing_transactions`에 bonus 기록.
5. **BillingEngine**
   - `addDailyBonus(userId, amountP)`를 실제로 호출하는 구현체가 있으면 그쪽으로 위 로직 연결. 없으면 subscribe와 동일하게 직접 `panana_billing_profiles` + `panana_billing_transactions` 업데이트하는 서비스 함수를 한 곳에 두고, cron/출석 API에서 호출.

**산출물**: 구독자에게 매일 500 P 자동 지급, 월 30,000 P 초과 방지.

---

### Phase 3: 충전 상품 스펙 동기화 (선택)

**목표**: 앱/관리자에 노출되는 상품명·가격이 첨부 스펙과 완전히 일치.

1. **DB 시드/마이그레이션**
   - `panana_billing_products`에 위 6개 상품 (설레는 첫걸음 ~ 파나나 킹덤) sku/title/price_krw/pana_amount/bonus_amount 로 upsert.
2. **상수/폴백**
   - `RECHARGE_PRODUCTS`(constants)는 DB 없을 때 폴백용으로만 쓰이면, DB와 동일한 값으로 맞추거나 “DB 우선”만 유지.
3. **관리자**
   - admin billing 페이지에서 위 6개 상품 편집/비활성화만 가능해도 됨.

**산출물**: 스펙서와 동일한 6개 충전 상품 노출 및 결제 연동.

---

### Phase 4: 채팅/음성 차감에 구독 할인 반영 검증

**목표**: 이미 정의된 48/32 P, 음성 50% 할인이 실제 차감에 적용되는지 확인.

1. **채팅**
   - `/api/llm/chat`(또는 채팅 P 차감을 수행하는 서비스)에서 `is_subscriber`일 때 `SUBSCRIPTION_DEEP_P_PER_TURN` / `SUBSCRIPTION_NSFW_DEEP_P_PER_TURN` 사용하는지 확인.
   - BillingEngine을 쓰는 경우, 구현체에서 구독 여부 조회 후 위 상수 사용하도록 수정.
2. **음성**
   - 음성 P 차감하는 API에서 `is_subscriber`일 때 5 P/초 적용 여부 확인.

**산출물**: 구독자는 심층 20% 할인, 음성 50% 할인이 실제 결제/잔액에 반영됨.

---

## 4. 구현 순서 제안

| 순서 | 단계 | 예상 공수 |
|------|------|-----------|
| 1 | Phase 1: 구독 즉시 15,000 P 지급 | 소 |
| 2 | Phase 4: 구독 할인 적용 검증 | 소 |
| 3 | Phase 2: 매일 500 P 지급 (DB + cron/출석 API) | 중 |
| 4 | Phase 3: 충전 상품 6종 스펙 동기화 | 소 |

---

## 5. 시간(KST) 통일

- DB에 기록하는 시간은 모두 **KST(한국 표준시)** 기준입니다.
- `src/lib/kst.ts`: `nowKstIso()`, `todayKst()`, `toKstIso()` 제공.
- 결제·구독·일일보너스 관련 `panana_billing_profiles`, `panana_billing_transactions`, `panana_subscription_daily_grants`의 `created_at`/`updated_at`은 위 유틸로 KST ISO 문자열(`+09:00`)을 넣어 기록합니다.

---

## 6. 일일 500 P 지급 (방문 시에만)

- **규칙**: 구독자는 **매일 앱에 들어온 날**에만 500 P 수령. 들어오지 않은 날은 그날 분 500 P 소멸(누적 안 됨).
- **동작**: `GET /api/me/balance` 호출 시(잔액 조회 = 방문으로 간주) 당일 KST 기준 미수령이면 자동으로 500 P 지급 후 잔액 반환. 응답에 `dailyBonusClaimed: true` 포함.
- **전용 API**: `GET /api/me/daily-bonus-claim` — 수령만 하고 싶을 때 호출 가능. (balance 호출만 해도 자동 수령됨)
- **크론 미사용**: 전원 자동 지급 크론은 사용하지 않음. `vercel.json` cron 제거됨.

---

## 7. 정리

- **충전**: 이미 1:1+보너스·결제 연동 있음. 상품만 스펙에 맞게 6종 확정하면 됨.
- **구독**: “충전형 구독”을 위해 **즉시 15,000 P**와 **매일 500 P**가 필수이며, 현재 둘 다 미구현이므로 Phase 1 → Phase 2 순으로 구현하면 됨.
- **모델별 차감·구독 할인**: 상수는 준비돼 있으므로, 실제 차감 호출부에서 구독 여부만 반영하면 됨.

이 문서를 기준으로 Phase 1부터 구현하면, 첨부하신 “충전형 구독형” 스펙과 동일한 구조로 맞출 수 있습니다.
