import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const THROTTLE_MS = 24 * 60 * 60 * 1000; // 24h

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

function getSb() {
  const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

async function ensurePananaUser(sb: ReturnType<typeof getSb>, pananaId: string) {
  const { data: u } = await sb.from("panana_users").select("id").eq("id", pananaId).maybeSingle();
  if (u?.id) return;
  throw new Error("Invalid pananaId");
}

/** 마이 탭 비진입 시에도 안부 오프닝을 미리 생성해 DB에 저장. 클라이언트는 홈 로드 시 이 API를 호출하고, generated 시 incrementUnread 후 배지 표시. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const pananaId = String(body?.pananaId || "").trim();
    const characterSlug = String(body?.characterSlug || "").trim().toLowerCase();
    if (!isUuid(pananaId)) return NextResponse.json({ ok: false, error: "Invalid pananaId" }, { status: 400 });
    if (!characterSlug) return NextResponse.json({ ok: false, error: "Missing characterSlug" }, { status: 400 });

    const sb = getSb();
    await ensurePananaUser(sb, pananaId);

    const { data: msgRows, error: msgErr } = await sb
      .from("panana_chat_messages")
      .select("client_msg_id, from_role, text, at_ms")
      .eq("user_id", pananaId)
      .eq("character_slug", characterSlug)
      .order("created_at", { ascending: true })
      .limit(120);
    if (msgErr) throw msgErr;

    const messages = (msgRows || []).map((r: any) => ({
      id: String(r.client_msg_id || ""),
      from: String(r.from_role || "system"),
      text: String(r.text || ""),
      at: r.at_ms != null ? Number(r.at_ms) : null,
    }));

    if (messages.length === 0) return NextResponse.json({ ok: true, skipped: "no_history" });

    const last = messages[messages.length - 1];
    const lastAt = typeof last?.at === "number" ? last.at : 0;
    const now = Date.now();
    if (now - lastAt < THROTTLE_MS) return NextResponse.json({ ok: true, skipped: "recent" });

    const { data: userRow } = await sb
      .from("panana_users")
      .select("nickname, handle")
      .eq("id", pananaId)
      .maybeSingle();
    const nickname = String((userRow as any)?.nickname || "").trim();
    const handle = String((userRow as any)?.handle || "").trim();
    const resolvedUserName = nickname || handle || "너";

    const { data: charRow } = await sb
      .from("panana_public_characters_v")
      .select("name")
      .eq("slug", characterSlug)
      .maybeSingle();
    const characterName = String((charRow as any)?.name || characterSlug);

    const history = messages
      .filter((m) => m.from !== "system")
      .slice(-40)
      .map((m) => ({
        role: m.from === "user" ? "user" : "assistant",
        content: m.text,
      })) as Array<{ role: "user" | "assistant"; content: string }>;

    const hoursAgo = Math.round((now - lastAt) / (60 * 60 * 1000));
    const daysAgo = hoursAgo >= 24 ? Math.round(hoursAgo / 24) : 0;
    const timeLabel = daysAgo > 0 ? `${daysAgo}일만` : `${hoursAgo}시간만`;
    const returningPrompt = [
      "대화 시작.",
      `유저가 ${timeLabel}에 대화방에 들어왔다.`,
      "[유저 프로필]과 [우리의 지난 서사]와 위 대화를 참고해, 유저가 과거에 언급한 일(면접, 시험, 맞선, 중요한 일정 등)이 지났거나 다가오면 자연스럽게 안부를 물어봐라.",
      "이미 대화에서 유저가 결과를 말한 주제는 다시 묻지 마라.",
      "2~4문장, 캐릭터 대사만 출력해라.",
    ].join(" ");

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const baseUrl = host ? `${proto === "https" ? "https" : "http"}://${host}` : process.env.NEXTAUTH_URL || "http://localhost:3000";
    const llmUrl = `${baseUrl.replace(/\/$/, "")}/api/llm/chat`;

    const runtimeVariables: Record<string, string> = {
      user_name: resolvedUserName,
      call_sign: resolvedUserName,
      ...(handle ? { user_handle: handle, panana_handle: handle } : {}),
      panana_id: pananaId,
    };

    const llmRes = await fetch(llmUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "anthropic",
        characterSlug,
        concise: false,
        allowUnsafe: false,
        runtime: { variables: runtimeVariables, chat: {} },
        messages: [
          { role: "system", content: `${characterName} 캐릭터로 자연스럽게 대화해.` },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: returningPrompt },
        ],
      }),
    });
    const llmData = await llmRes.json().catch(() => null);
    if (!llmRes.ok || !llmData?.ok) {
      return NextResponse.json({ ok: false, error: llmData?.error || "LLM failed" }, { status: 500 });
    }
    const reply = String(llmData?.text || "").trim();
    if (!reply) return NextResponse.json({ ok: true, skipped: "empty_reply" });

    const clientMsgId = `b-${Date.now()}-returning`;
    const { error: insertErr } = await sb.from("panana_chat_messages").upsert(
      {
        user_id: pananaId,
        character_slug: characterSlug,
        client_msg_id: clientMsgId,
        from_role: "bot",
        text: reply,
        at_ms: now,
      },
      { onConflict: "user_id,character_slug,client_msg_id" }
    );
    if (insertErr) throw insertErr;

    return NextResponse.json({ ok: true, generated: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
