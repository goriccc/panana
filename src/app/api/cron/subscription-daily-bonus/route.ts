import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 일일 보너스는 크론으로 전원 지급하지 않습니다.
 * 구독자는 "매일 방문"한 날에만 500 P 수령 (GET /api/me/balance 호출 시 자동 수령).
 * 안 들어오면 그날 분은 소멸.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Daily bonus is granted on user visit only. Use GET /api/me/balance to trigger claim.",
  });
}
