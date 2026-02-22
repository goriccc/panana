import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SUMMARY_SYSTEM =
  "당신은 통화 대화 기록을 요약하는 도구다. 주어진 대화를 **정확히 3문장**으로 요약한다. " +
  "한국어로만 출력한다. 요약에는 누가 무엇을 말했는지, 어떤 주제/감정/결론이 있었는지를 담는다. " +
  "출력은 요약 3문장만 하고, 설명이나 접두어는 넣지 않는다.";

/** 통화 재연결 시 맥락 유지용: Gemini 2.5 Flash로 이전 통화를 3줄 요약 (비용 최소화) */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const recentChat = body?.recentChat;
    if (!Array.isArray(recentChat) || recentChat.length === 0) {
      return NextResponse.json({ ok: false, error: "recentChat 배열 필요" }, { status: 400 });
    }

    const transcript = recentChat
      .map((m: { from?: string; text?: string }) => {
        const from = m.from === "user" ? "유저" : "캐릭터";
        const text = String(m.text ?? "").trim();
        return text ? `${from}: ${text}` : null;
      })
      .filter(Boolean)
      .join("\n");

    if (!transcript.trim()) {
      return NextResponse.json({ ok: false, error: "요약할 대화 내용 없음" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Gemini API key not configured" }, { status: 503 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SUMMARY_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: `다음 통화 대화를 3문장으로 요약해 주세요.\n\n${transcript}` }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 256,
          responseMimeType: "text/plain",
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: (data?.error?.message || res.statusText) || "요약 생성 실패" },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const summary = Array.isArray(parts)
      ? parts
          .map((p: { text?: string }) => p?.text)
          .filter(Boolean)
          .join(" ")
          .trim()
      : "";

    if (!summary) {
      return NextResponse.json({ ok: false, error: "요약 결과 없음" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "요약 생성 실패" },
      { status: 500 }
    );
  }
}
