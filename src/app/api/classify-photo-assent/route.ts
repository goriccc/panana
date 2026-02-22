import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM = `You classify whether the character's (assistant's) message means they are agreeing or willing to send a photo/selfie to the user.

agreed: true — 캐릭터가 사진/셀카를 보내 주겠다고 명시적·의미적으로 동의한 경우
- "보내줄게", "보낼게", "보내드릴게", "찍어서 보낼게", "여기 있어", "보냈어"
- "좋아, 보낼게", "알겠어, 보낼게", "그럼 이거 보낼게"
- 사진을 첨부·전송하는 뉘앙스가 있는 응답

agreed: false — 캐릭터가 거절·거부·미룬 경우 (이때는 이미지 생성하면 안 됨)
- "안 돼요", "못 보내", "부끄러워", "싫어", "안 보낼게", "못 해"
- "오늘 촬영 의상 입고 있는데... 안 돼요, 부끄럽거든요?"
- "나중에", "다음에", "지금은 안 돼", "사진은 좀..."
- 명시적 거절이 없어도 "갑자기요? 전신이요? 😳 ... 안 돼요"처럼 결국 거절한 경우

Output only valid JSON: {"agreed": true} or {"agreed": false}. No other text.`;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const assistantMessage = typeof body?.assistantMessage === "string" ? body.assistantMessage.trim() : "";
    if (!assistantMessage) {
      return NextResponse.json({ ok: false, error: "assistantMessage required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json({ ok: true, agreed: false }, { status: 200 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ parts: [{ text: assistantMessage }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 32,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: { agreed: { type: "boolean" } },
            required: ["agreed"],
          },
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ ok: true, agreed: false });
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const raw = Array.isArray(parts) ? parts.map((p: any) => p?.text).filter(Boolean).join("").trim() : "";
    let agreed = false;
    try {
      const parsed = JSON.parse(raw || "{}") as { agreed?: boolean };
      agreed = Boolean(parsed?.agreed);
    } catch {
      // fallback: do not generate when classification fails
    }

    return NextResponse.json({ ok: true, agreed });
  } catch (e) {
    return NextResponse.json({ ok: true, agreed: false });
  }
}
