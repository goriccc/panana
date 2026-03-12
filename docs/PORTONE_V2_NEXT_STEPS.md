# PortOne 결제모듈 v2 – 테스트모드 다음 단계

테스트 채널을 추가한 뒤, **결제 페이지에서 결제 모듈을 호출**하고 **결제 완료 시 서버에서 검증·잔액 적립**까지 구현해야 PG/카드사 심사가 진행됩니다.

## 1. 포트원 연동 정보 확인

- **연동 정보 > 식별코드 · API Keys**: **Store ID**(식별코드), **API Secret**(서버 전용, 클라이언트에 노출 금지)
- **연동 정보 > 채널 관리** (테스트 탭): 아래 4개 채널은 **채널마다 채널키 값이 모두 다릅니다.** 각 채널에서 복사한 값을 해당 env에 넣으세요.
  - `panana_kg이니시스_충전형` → KG 이니시스 충전(일회성)
  - `panana_kg이니시스_구독형` → KG 이니시스 구독(멤버십)
  - `panana_카카오_충전형` → 카카오페이 충전(일회성)
  - `panana_카카오_구독형` → 카카오페이 구독(멤버십)

## 2. 환경 변수 설정

프로젝트 `.env` 또는 배포 환경에 다음을 추가하세요.

**앱이 결제창을 띄울 때 사용하는 변수는 두 개뿐입니다.**

- **충전(일회성)** 결제 시 → `NEXT_PUBLIC_PORTONE_CHANNEL_KEY` 값을 씁니다.
- **구독(멤버십)** 결제 시 → `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_SUBSCRIPTION` 값을 씁니다.

그래서:

1. **충전**으로 KG 이니시스를 쓰려면: 포트원 채널 관리에서 `panana_kg이니시스_충전형` 채널키를 복사해서 `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`에 넣습니다.  
   **충전**으로 카카오페이를 쓰려면: `panana_카카오_충전형` 채널키를 복사해서 `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`에 넣습니다. (둘 중 하나만 설정)

2. **구독**으로 KG 이니시스를 쓰려면: `panana_kg이니시스_구독형` 채널키를 복사해서 `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_SUBSCRIPTION`에 넣습니다.  
   **구독**으로 카카오페이를 쓰려면: `panana_카카오_구독형` 채널키를 복사해서 `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_SUBSCRIPTION`에 넣습니다. (둘 중 하나만 설정)

```env
# PortOne v2
NEXT_PUBLIC_PORTONE_STORE_ID=store-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# 충전 결제 시 사용할 채널키 1개 (KG 충전형 또는 카카오 충전형 중 선택해서 채널 관리에서 복사)
NEXT_PUBLIC_PORTONE_CHANNEL_KEY=channel-key-...

# 구독 결제 시 사용할 채널키 1개 (KG 구독형 또는 카카오 구독형 중 선택해서 채널 관리에서 복사)
NEXT_PUBLIC_PORTONE_CHANNEL_KEY_SUBSCRIPTION=channel-key-...

PORTONE_API_SECRET=xxxxxxxx  # 서버 전용. 결제 검증용
```

- `NEXT_PUBLIC_PORTONE_STORE_ID`: 연동 정보 > 식별코드 · API Keys의 **식별코드**
- `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`: **충전** 결제창에 쓸 채널키 **한 개**. KG로 충전받을 거면 KG 이니시스 충전형 채널키, 카카오로 받을 거면 카카오 충전형 채널키를 넣으면 됨.
- `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_SUBSCRIPTION`: **구독** 결제에 쓸 채널키 **한 개**. KG로 구독받을 거면 KG 구독형 채널키, 카카오로 받을 거면 카카오 구독형 채널키를 넣으면 됨.
- `PORTONE_API_SECRET`: 연동 정보 > API Keys에서 **API Secret** (서버에서만 사용)

(4개 채널키를 각각 따로 변수로 두고 싶다면 `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KG_CHARGE`, `_KG_SUBSCRIPTION`, `_KAKAO_CHARGE`, `_KAKAO_SUBSCRIPTION` 같은 이름으로 넣어 두고, 위 두 변수에는 “지금 쓰는” 채널키 값만 복사해 넣어도 됩니다.)

**KG / 카카오 중 하나만 써야 하나요?**  
아니요. 충전용 채널 하나, 구독용 채널 하나를 **각각** 정하면 됩니다. 예: 충전은 KG, 구독은 카카오 / 둘 다 KG / 둘 다 카카오 — 모두 가능합니다.

**고객이 결제할 때마다 PG를 선택하게 해야 하나요?**  
아니요. PG는 서비스에서 한 번 정해 두고 바꿀 일이 거의 없으므로, 보통 **KG로 통일**하거나 **카카오로 통일**해서 env에 채널키만 넣어 두면 됩니다. 고객에게 “KG로 결제 / 카카오로 결제”를 선택하게 할 필요는 없습니다.

## 3. 앱에서 해야 할 일 (구현 흐름)

1. **충전하기 클릭**  
   - 선택한 상품(SKU, 금액, 상품명)으로 결제 요청  
   - PortOne 결제모듈 v2 호출: `requestPayment({ storeId, channelKey, paymentId, orderName, totalAmount, ... })`  
   - `paymentId`는 우리가 생성한 **고유 주문번호** (예: `panana-{timestamp}-{random}`)

2. **결제 완료 후**  
   - PortOne이 `redirectUrl`로 리다이렉트 (예: `/my/charge?paymentId=xxx`)  
   - 해당 페이지에서 **같은 paymentId + 상품 SKU**로 서버에 **결제 확인 요청**

3. **서버 결제 검증**  
   - PortOne 서버 API로 해당 `paymentId`(주문번호) 결제 상태·금액 조회  
   - 금액이 선택 상품과 일치하면  
     - `panana_billing_profiles`에 충전 P 반영 (`amount_base` / `amount_bonus` 등)  
     - `panana_billing_transactions`에 recharge 트랜잭션 저장  

이 흐름이 구현되어 있으면, **결제 페이지 + 결제 모듈 호출**이 갖춰진 것으로 보고 테스트모드 설정이 완료된 상태가 됩니다.

## 4. 이 레포에서 구현된 흐름

- **충전(일회성)**: **충전하기** 클릭 시 `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`(충전형)로 PortOne v2 `requestPayment` 호출 (리디렉션 방식).
- **구독(멤버십)**: 파나나 패스 등 구독 결제를 연동할 때는 `NEXT_PUBLIC_PORTONE_CHANNEL_KEY_SUBSCRIPTION`(구독형 채널키)을 사용해 별도 플로우로 구현하면 됩니다.
- 결제 완료 후 `/my/charge?paymentId=xxx`로 돌아오면, 프론트에서 `POST /api/payment/confirm`에 `{ paymentId, sku }` 전달.
- 서버는 PortOne API로 해당 결제 조회 후 `status === 'PAID'`이고 금액이 상품과 일치하면, 해당 유저의 `panana_billing_profiles`에 P를 더하고 `panana_billing_transactions`에 recharge 기록.

테스트 시 **로그인한 상태**에서 충전하기를 눌러야 결제 확인 및 잔액 적립이 됩니다.

## 5. 참고 문서

- [V2 연동하기 > 인증 결제 연동하기](https://developers.portone.io/docs/ko/v2-payment/authpay?v=v2)
- [JavaScript SDK (npm: @portone/browser-sdk)](https://www.npmjs.com/package/@portone/browser-sdk)
- 포트원 REST API(V2): 결제 단건 조회 등 서버 검증 시 [PortOne REST API - V2](https://developers.portone.io/api/rest-v2/pgSpecific) 참고
