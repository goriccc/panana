import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * xAI Grok Voice Agent용 ephemeral token 발급.
 * 클라이언트는 이 토큰으로 wss://api.x.ai/v1/realtime 에 직접 연결.
 */
export async function POST() {
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "XAI_API_KEY가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (data as any)?.error?.message ?? (data as any)?.message ?? `HTTP ${res.status}`;
      return NextResponse.json({ ok: false, error: String(err) }, { status: res.status >= 500 ? 502 : 400 });
    }

    const clientSecret = (data as any)?.client_secret ?? (data as any)?.value;
    if (!clientSecret || typeof clientSecret !== "string") {
      return NextResponse.json({ ok: false, error: "토큰을 받지 못했습니다." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, client_secret: clientSecret });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
