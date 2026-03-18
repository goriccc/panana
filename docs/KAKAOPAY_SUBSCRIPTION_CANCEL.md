# 카카오페이 정기결제(구독) 해지 시 처리 안내

구독 해지 시 **카카오페이에 직접 API를 호출하지 않습니다.**  
결제 연동이 **포트원(PortOne)** 을 통해 이루어지므로, 해지는 **포트원 REST API**로만 처리하면 됩니다.

---

## 1. 우리 서버에서 하는 일

1. **빌링키 삭제**  
   포트원에 `DELETE https://api.portone.io/billing-keys/{billingKey}` 요청을 보냅니다.  
   포트원이 해당 빌링키를 삭제하고, 내부적으로 카카오페이 등 PG사에 해지(빌링키 무효화)를 전달합니다.

2. **DB 반영**  
   `panana_billing_profiles`에서 해당 유저의  
   `is_subscriber = false`, `subscription_billing_key = null` 로 업데이트합니다.

---

## 2. 포트원에 전달하는 정보

| 항목 | 값 |
|------|-----|
| **엔드포인트** | `DELETE https://api.portone.io/billing-keys/{billingKey}` |
| **인증** | `Authorization: Bearer {accessToken}` (API Secret으로 `POST /login/api-secret` 호출 후 발급) |
| **path 파라미터** | `billingKey` — 가입 시 발급받아 DB에 저장해 둔 빌링키 문자열 |

별도로 카카오페이 전용 필드나 해지 사유 등을 보낼 필요는 없습니다.  
빌링키만 삭제하면 포트원이 PG(카카오페이) 쪽 정기결제 해지까지 처리합니다.

---

## 3. 카카오페이 측에서 일어나는 일

- 포트원이 빌링키 삭제 요청을 받으면, 카카오페이 빌링키 해지 API를 호출합니다.
- 카카오페이는 해당 빌링키로의 **이후 자동 결제를 중단**합니다.
- 가맹점이 카카오페이에 직접 빌링키 해지 API를 호출할 필요는 없습니다 (포트원이 대신 수행).

---

## 4. 구현 위치 (참고)

- **해지 API**: `src/app/api/membership/cancel/route.ts`  
  - `deleteBillingKey(billingKey)` → PortOne `DELETE /billing-keys/{billingKey}`  
  - 이후 `panana_billing_profiles` 업데이트
- **빌링키 저장**: 가입 시 `src/app/api/membership/subscribe/route.ts`에서  
  `subscription_billing_key`에 저장 (DB 컬럼: `docs/panana-admin/ADD_SUBSCRIPTION_STARTED_AND_BILLING_KEY.sql`)

---

## 5. 참고 문서

- [PortOne REST API V2 - 빌링키 삭제](https://developers.portone.io/api/rest-v2/payment.billingKey?v=v2)  
  - `delete/billing-keys/{billingKey}`  
- 포트원 관리자 콘솔: 결제 연동 > 채널 설정에서 카카오페이 정기결제 채널 확인
