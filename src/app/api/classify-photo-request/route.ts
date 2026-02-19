import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM = `You classify whether the user message means they are seriously asking the character to take a photo (or selfie) and send it to them.

Examples that MUST be true (isPhotoRequest: true):
- "사진 찍어 보내", "사진 찍어 보내줘", "사진 찍어서 보내줄래?"
- "셀카 찍어 보내", "셀카 찍어 보내줘", "셀카 찍어 보내줄래?"
- "셀카 보내줘", "사진 보내줘", "사진 좀 보내줘", "사진 하나 보내줘", "사진 한 장 보내줘", "찍어서 보내줘"
- "셀카 좀", "셀카 한 장만", "셀카 보내", "사진 보내", "사진 전송해줘"

Examples that MUST be false (isPhotoRequest: false):
- General chat, greetings, questions unrelated to photos
- "사진 좋아해?" (asking if they like photos), "사진 보는 거 좋아해"
- Sarcasm or joke that is clearly not a real request

Output only valid JSON: {"isPhotoRequest": true} or {"isPhotoRequest": false}. No other text.`;

function isClearPhotoRequest(message: string): boolean {
  const s = String(message || "").trim();
  if (!s) return false;
  // "사진/셀카 + (좀/한 장/하나...) + 보내/전송" 혹은 반대 어순을 폭넓게 허용
  const explicitRequest =
    /(?:사진|셀카|셀피|selfie|photo|pic)[^.!?\n]{0,24}?(?:찍(?:어|어서)?\s*)?(?:보내(?:줘|주라|주세요|줘요|줄래)?|전송(?:해|해줘|해주세요)?)(?:\s*줘)?|(?:보내(?:줘|주라|주세요|줘요|줄래)?|전송(?:해|해줘|해주세요)?)[^.!?\n]{0,24}?(?:사진|셀카|셀피|selfie|photo|pic)/i;
  const shortNaturalRequest = /^(?:셀카|사진)\s*(?:좀|하나|한\s*장|한장)?\s*(?:만)?\s*$/i;
  return explicitRequest.test(s) || shortNaturalRequest.test(s);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });
    }

    // "사진/셀카 좀 보내줘" 등 명확한 요청은 Gemini 호출 없이 즉시 true (fallback 보장)
    if (isClearPhotoRequest(message)) {
      return NextResponse.json({ ok: true, isPhotoRequest: true }, { status: 200 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ ok: true, isPhotoRequest: false }, { status: 200 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ parts: [{ text: message }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 32,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: { isPhotoRequest: { type: "boolean" } },
            required: ["isPhotoRequest"],
          },
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ ok: true, isPhotoRequest: false });
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const raw = Array.isArray(parts) ? parts.map((p: any) => p?.text).filter(Boolean).join("").trim() : "";
    let isPhotoRequest = false;
    try {
      const parsed = JSON.parse(raw || "{}") as { isPhotoRequest?: boolean };
      isPhotoRequest = Boolean(parsed?.isPhotoRequest);
    } catch {
      // fallback: assume false
    }

    return NextResponse.json({ ok: true, isPhotoRequest });
  } catch (e) {
    return NextResponse.json({ ok: true, isPhotoRequest: false });
  }
}
