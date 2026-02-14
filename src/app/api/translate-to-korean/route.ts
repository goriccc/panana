import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM =
  "You convert text to Korean script by pronunciation only. Do NOT translate meaning. " +
  "Rules: Output only the result, no explanation. " +
  "If the input is already in Korean, return it as-is. " +
  "For foreign words or loanwords, write exactly how they sound in 한글 (e.g. hello → 헬로, computer → 컴퓨터, iPhone → 아이폰). " +
  "Keep the same words and meaning; only change the script to Korean phonetic spelling.";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Gemini API key not configured" }, { status: 503 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
          responseMimeType: "text/plain",
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: (data?.error?.message || res.statusText) || "Translation failed" },
        { status: res.status >= 500 ? 502 : 400 }
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const translated =
      Array.isArray(parts) ? parts.map((p: any) => p?.text).filter(Boolean).join("\n").trim() : "";
    const out = translated || text;

    return NextResponse.json({ ok: true, text: out });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Translation failed" },
      { status: 500 }
    );
  }
}
