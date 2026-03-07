# Panana AI: Final 1:1 Billing & Logic System Spec

## 1. Currency Standard
- **1 KRW = 1 P** (Point).
- Divide wallet into **`amount_base`** (Cash) and **`amount_bonus`** (Free).

## 2. Dynamic Model Orchestrator (Margin 80%)
Automatically select model and deduct points per turn:

| Mode | Tier | Model | P/turn | Subscriber |
|------|------|-------|--------|------------|
| Normal | Standard | Claude 4.6 Haiku | 20 P | — |
| Normal | Deep | Claude 4.6 Sonnet | 60 P | 48 P |
| NSFW | Standard | Gemini 2.5 Flash | 10 P | — |
| NSFW | Deep | Gemini 2.5 Pro | 40 P | 32 P |
| Voice (Native Audio) | — | Gemini 2.5 Flash | 10 P **per second** | (50% off: 5 P/sec) |

Constants: `src/lib/billing/constants.ts` — `P_PER_TURN`, `SUBSCRIPTION_DEEP_P_PER_TURN`, `SUBSCRIPTION_NSFW_DEEP_P_PER_TURN`, `P_PER_VOICE_SECOND`.

## 3. Financial Products
- **Recharge**: [2.9k→3k], [5.9k→6.5k], [12.9k→15k], [29k→35k], [49k→60k], [99k→120k] (KRW → P).
- **Subscription (Panana Pass)**: 14,900 KRW/month.
  - 15,000 P instantly + **500 P daily login bonus**.

Live products: DB `panana_billing_products`; constants are reference/fallback.

## 4. Constraints
- **80% margin**: Monitor API token usage vs. point deduction; adjust P/turn or pricing if margin drifts.
- **Consumption order**: **`amount_bonus`** is consumed before **`amount_base`**.

## DB & Implementation
- **Schema**: `BILLING_1_1_RATIO.sql` — profiles: `amount_base`, `amount_bonus`; transactions: `amount_base`, `amount_bonus`, `total_amount`.
- **Balance API**: `GET /api/me/balance` returns `pananaBalance` (total) and optionally `amountBase`, `amountBonus`.
- **Deduction**: Not yet implemented. When implementing BillingEngine: deduct from `amount_bonus` first, then `amount_base`; record in `panana_billing_transactions` and `panana_usage_logs`.
