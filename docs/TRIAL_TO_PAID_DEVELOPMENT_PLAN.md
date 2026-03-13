# 맛보기(무료 이용) → 충전/구독 전환 개발 플랜

첨부하신 비즈니스 로직·수익성 시뮬레이션·리스크 방어 전략을 반영한 개발 플랜입니다.  
**기존 유료(충전/구독) 기능은 수정하지 않고, 맛보기 전용 규칙과 데이터만 추가**합니다.

---

## 1. 비즈니스 요약 (첨부 기준)

| 항목 | 내용 |
|------|------|
| **초기 투자** | 가입 즉시 **500 P** 지급 (맛보기 크레딧) |
| **유지 비용** | **매일 100 P** 지급 (무료 유저, **가입일 익일부터** 방문 시 수령) |
| **목표 전환율** | 4.5% 미만 시 적자, **10% 이상** 시 안정 마진 (1:1 환율 가정) |
| **리스크 방어** | Context Capping(15회마다 강제 요약), 음성 30초 제한·양방향 실시간은 유료 전용 |

---

## 2. 현재 코드베이스 상태

| 구분 | 상태 | 비고 |
|------|------|------|
| **잔액/명세** | ✅ | `panana_billing_profiles` (amount_base, amount_bonus, panana_balance) |
| **구독자 일일 500 P** | ✅ | `claimDailyBonus` + `/api/me/balance` 방문 시 자동 수령 |
| **맛보기 초기 500 P** | ✅ | 첫 잔액 조회 시 프로필 생성 + 500 P 지급 |
| **맛보기 일일 100 P** | ✅ | 비구독자, 가입일 익일부터 방문 시 지급 |
| **유저 구분** | △ | `is_subscriber`만 있음, “맛보기 전용 유저” 플래그 없음 |
| **채팅 P 차감** | △ | BillingEngine 인터페이스·computeP 정의만 있고, `/api/llm/chat`에 미연동 가능성 |
| **Context Capping** | ✅ 동일 | `hybridMemory` 20턴 요약만 사용, **무료/유료 구분 없음 (20턴 유지)** |
| **음성 제한** | ❌ | 무료 30초/유료 전용 실시간 구분 없음 |

---

## 3. 개발 플랜 (Phase 단위)

### Phase 0: 상수·정책 정의

**목표**: 맛보기 수치를 한 곳에서 관리.

1. **`src/lib/billing/constants.ts`**
   - `TRIAL_WELCOME_P = 500` (가입 즉시 지급)
   - `TRIAL_DAILY_P = 100` (비구독자 일일 지급, 가입일 익일부터 방문 시)
   - (선택) `TRIAL_DAILY_GRANT_MAX_PER_MONTH` 등 캡 정책이 있으면 추가

2. **원장/트랜잭션 구분**
   - `panana_ledger_kind`에 `trial_welcome`, `trial_daily` 추가 검토  
     또는 기존 `grant` + `note`로 “맛보기 가입”, “맛보기 일일” 구분.

**산출물**: 맛보기 P 값·종류가 코드/DB에서 일관되게 사용됨.

---

### Phase 1: 맛보기 초기 500 P (가입 즉시)

**목표**: 유저가 최초 생성되는 시점에 billing 프로필이 없으면 생성하고 500 P 지급.

1. **프로필 생성 시점**
   - 후보: `POST /api/me/identity` (panana_users 생성/매핑 시), 또는  
     첫 잔액 조회 시점(`GET /api/me/balance`에서 프로필 없으면 생성 후 1,000 P).
   - **권장**: `GET /api/me/balance`에서 `panana_billing_profiles` 없으면  
     `ensureBillingProfileWithTrialWelcome(sb, userId)` 호출 → 프로필 생성 + 500 P 지급.

2. **로직**
   - `panana_billing_profiles`에 해당 `user_id` 없으면:
     - insert: `amount_bonus: 500`, `panana_balance: 500`, `trial_started_at: 오늘(KST)`,  
       `is_subscriber: false`.
     - `panana_billing_transactions`에 type `bonus`(또는 `grant`), description "맛보기 가입 지급".
     - (원장 사용 시) `panana_ledger`에 kind `grant`, note "맛보기 가입".

3. **중복 방지**
   - “맛보기 가입”은 1회만: 트랜잭션/원장에 “trial_welcome” 등으로 기록해, 이미 있으면 지급 스킵.

**산출물**: 신규 유저가 첫 잔액 조회(또는 identity 정리) 시 500 P를 받고, 유료 전환 유도 문구 노출 가능.

---

### Phase 2: 맛보기 일일 100 P (비구독자, 가입일 익일부터 방문 시)

**목표**: 구독자가 아닌 유저에게 “가입일 익일부터 매일 방문 시 100 P” 지급. 구독자 500 P와 병행 가능.

1. **지급 조건**
   - `is_subscriber === false`.
   - `grant_date > trial_started_at` (가입일 당일은 지급하지 않음, 익일부터).
   - 당일(KST) 이미 “맛보기 일일” 수령 이력이 없음.

2. **DB**
   - `panana_trial_daily_grants (user_id, grant_date date, amount_p, created_at)`  
     또는 기존 `panana_subscription_daily_grants`와 유사한 테이블을 trial 전용으로 생성.
   - 당일 1건만 허용하도록 unique(user_id, grant_date) 또는 조회로 중복 방지.

3. **실행 시점**
   - **옵션 A (권장)**: `GET /api/me/balance` 호출 시(방문으로 간주)  
     - 구독자면 기존처럼 `tryClaimDailyBonusIfEligible` (500 P)  
     - 비구독자면 “맛보기 일일” 미수령 시 100 P 지급 (가입일 익일부터).
   - 전용 `GET /api/me/daily-bonus-claim`에서 구독 500 P / 비구독 100 P 처리.

4. **캡 (선택)**
   - 이미지 기준 “한 달 최대 7,000 P” 등 제한이 있으면,  
     월별 맛보기 일일 지급 합계를 세어 상한 적용.

**산출물**: 비구독자는 가입일 익일부터 방문 시 100 P, 구독자는 500 P를 받고, 전환 유도 UI에 “오늘 100 P 받기” 등 노출 가능.

---

### Phase 3: 유저 구분 (맛보기 vs 유료) 정리

**목표**: 리스크 방어·전환율 측정을 위해 “맛보기만 사용 중인 유저”를 구분.

1. **정의**
   - **유료 유저**: `is_subscriber === true` 또는 `amount_base > 0` 이력 있음(충전 이력) 또는  
     `panana_billing_transactions`에서 type `recharge`/구독 즉시 지급 1건 이상.
   - **맛보기 유저**: 유료가 아닌 유저 (처음 1,000 P + 일일 200 P만 사용).

2. **구현**
   - `panana_billing_profiles`에 `has_ever_paid boolean default false` 추가하거나,  
     기존 `amount_base`·트랜잭션으로 “한 번이라도 결제/구독 즉시 P” 받았는지 조회.
   - 서비스 레이어에서 `isTrialOnlyUser(profile, transactions)` 같은 함수로  
     “맛보기 전용” 여부 반환.

3. **사용처**
   - Phase 4(Context Capping), Phase 5(음성 제한), 대시보드 전환율 지표.

**산출물**: API/백엔드에서 “맛보기 전용” 여부를 일관되게 판별 가능.

---

### Phase 4: Context Capping (무료도 20턴 요약 유지)

**결정**: 무료/유료 구분 없이 **모두 20턴마다 요약** 적용.  
`hybridMemory`의 `SUMMARY_EVERY_N_USER_TURNS = 20`을 그대로 사용하며, 무료 전용 15턴 분기는 두지 않음.

---

### Phase 5: 음성 원가 방어 (무료 30초, 실시간 양방향은 유료 전용)

**목표**: 음성 모델(Gemini Native 등) 원가가 높으므로,  
무료 유저는 **약 30초**만 허용하고, **양방향 실시간 통화는 유료(Pass) 전용**으로 차단.

1. **무료 유저**
   - 음성 사용 시 **누적 사용 시간**을 서버/DB에 저장 (예: `panana_voice_usage` user_id, date, seconds_used).
   - 당일(또는 세션) **30초 초과 시** 요청 거부 또는 재생 중단 후 “유료 전환” 안내.

2. **실시간 양방향**
   - 기능이 별도 엔드포인트/플로우라면, 해당 진입 시점에  
     `is_subscriber === true`(또는 유료 유저)인지 검사.
   - 무료면 401/403 + “파나나 패스 가입 후 이용 가능” 메시지.

3. **상수**
   - `src/lib/billing/constants.ts`에  
     `TRIAL_VOICE_MAX_SECONDS_PER_DAY = 30` (또는 per-session) 정의.

**산출물**: 무료는 30초만 음성 사용 가능하고, 실시간 통화는 유료만 사용 가능.

---

### Phase 6: 전환 유도 UX (선택)

**목표**: 맛보기 사용 중 잔액이 줄어들 때·한도에 도달했을 때 충전/구독 유도.

1. **잔액/한도 노출**
   - 마이페이지·채팅 화면에 “맛보기 P: 200 P/일” 또는 “오늘 200 P 받기” 버튼.
   - 잔액이 N P 이하일 때 배너: “더 많은 대화를 위해 충전하거나 파나나 패스를 이용해 보세요.”

2. **음성 30초 도달 시**
   - 토스트/모달: “음성은 30초까지 무료로 이용 가능해요. 실시간 통화는 파나나 패스에서.”

3. **A/B 테스트**
   - 전환율 10% 목표에 맞춰, 문구·노출 시점을 나중에 실험 가능하도록  
     플래그나 설정으로 분리해 두면 유리.

**산출물**: 맛보기 → 충전/구독 전환 퍼널이 UI에 명확히 드러남.

---

## 4. 구현 순서 제안

| 순서 | Phase | 내용 | 예상 공수 |
|------|--------|------|-----------|
| 1 | Phase 0 | 맛보기 상수·정책 정의 | 소 |
| 2 | Phase 1 | 맛보기 초기 1,000 P (가입/첫 잔액 시) | 소 |
| 3 | Phase 2 | 맛보기 일일 200 P (비구독자, 방문 시) | 소 |
| 4 | Phase 3 | 맛보기 vs 유료 구분 로직 | 소 |
| 5 | Phase 4 | Context Capping (무료도 20턴 요약 유지, 분기 없음) | — |
| 6 | Phase 5 | 음성 30초 제한·실시간 통화 유료 전용 | 중 |
| 7 | Phase 6 | 전환 유도 UX (배너/버튼/메시지) | 소~중 |

---

## 5. 수익성·리스크 정리 (첨부 반영)

- **전환율 4.5% 미만**: 무료 이용 원가가 유료 마진을 상회해 적자.
- **전환율 10% 이상**: 1:1 환율에서 안정적 마진 확보 가능.
- **Context Capping**: 무료/유료 동일 20회마다 요약 유지.
- **음성**: 무료 30초, 양방향 실시간은 유료 전용 → 고비용 구간 방어.

이 플랜대로 Phase 0부터 순차 적용하면, 맛보기를 통한 충전/구독 전환 구조를 기존 기능을 건드리지 않고 도입할 수 있습니다.  
필요하면 Phase별로 상세 태스크(API 시그니처, DB 마이그레이션 초안)로 쪼개 드리겠습니다.
