import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { filterLorebookRows } from "@/lib/studio/unlockEngine";
import { buildTemplateVars, interpolateTemplate } from "@/lib/studio/templateRuntime";
import { applyTriggerPayloads, type ChatRuntimeEvent, type ChatRuntimeState } from "@/lib/studio/chatRuntimeEngine";

export const runtime = "nodejs";

function sanitizeAssistantText(raw: string, tvars: Record<string, any>) {
  // 1) 런타임 변수로 1차 치환
  let s = interpolateTemplate(String(raw || ""), tvars as any);
  // 2) 그래도 남는 {{var}}는 유저에게 그대로 노출되면 안 되므로 제거
  s = s.replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, "");
  // 3) 잔여 공백 정리(가독성)
  s = s
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
  return s.trim();
}

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
});

const BodySchema = z.object({
  provider: z.enum(["anthropic", "gemini", "deepseek"]),
  messages: z.array(MessageSchema).min(1),
  characterSlug: z.string().min(1).optional(),
  // (선택) 드라마형/씬 기반에서 씬 룰/라벨을 적용할 때 사용 (Studio scenes.id)
  sceneId: z.string().min(1).optional(),
  // 프론트 UX 옵션: 응답 길이를 짧게(2~3문장) 유도
  concise: z.boolean().optional(),
  // optional overrides (otherwise DB settings used)
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().min(1).max(8192).optional(),
  top_p: z.number().min(0).max(1).optional(),
  // 런타임 해금/진행 상태(선택): 엔딩 루트 등 로어북 해금 엔진에서 사용
  runtime: z
    .object({
      variables: z.record(z.any()).optional(),
      ownedSkus: z.array(z.string()).optional(),
      ending: z
        .object({
          unlockedKeys: z.array(z.string()).optional(),
          epCleared: z.array(z.union([z.string(), z.number()])).optional(),
        })
        .optional(),
      // 채팅 런타임(상태/참여자/쿨다운 등) - 선택
      chat: z
        .object({
          participants: z.array(z.string()).optional(),
          lastActiveAt: z.string().nullable().optional(),
          firedAt: z.record(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
});

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env");
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

async function loadSettings(provider: "anthropic" | "gemini" | "deepseek") {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("panana_llm_settings")
    .select("provider, model, temperature, max_tokens, top_p, force_parenthesis, nsfw_filter")
    .eq("scope", "global")
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        provider: string;
        model: string;
        temperature: number;
        max_tokens: number;
        top_p: number;
        force_parenthesis: boolean;
        nsfw_filter: boolean;
      }
    | null;
}

function getEnvKey(provider: "anthropic" | "gemini" | "deepseek") {
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY || "";
  if (provider === "gemini") return process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "";
  return process.env.DEEPSEEK_API_KEY || "";
}

async function callAnthropic(args: {
  apiKey: string;
  model: string;
  temperature: number;
  max_tokens: number;
  top_p?: number;
  messages: { role: "user" | "assistant"; content: string }[];
  system?: string;
}) {
  // 일부 Anthropic 모델은 temperature와 top_p를 동시에 받지 못한다.
  // 기본 정책: temperature를 우선하고 top_p는 보내지 않는다(호환성 최우선).
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature,
      max_tokens: args.max_tokens,
      system: args.system,
      messages: args.messages,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Anthropic error: ${res.status} ${JSON.stringify(data)}`);
  }
  // anthropic: content is array
  const text = Array.isArray(data?.content) ? data.content.map((c: any) => c?.text).filter(Boolean).join("\n") : "";
  return { text: text || "" };
}

async function callGemini(args: {
  apiKey: string;
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  allowUnsafe?: boolean;
}) {
  let maxOut = Number.isFinite(args.max_tokens) ? Math.max(16, Math.floor(args.max_tokens)) : 1024;
  if (/gemini-2\.5-pro/i.test(args.model)) {
    maxOut = Math.max(maxOut, 2048);
  }
  const maxSystemChars = 16000;
  const system = args.system ? (args.system.length > maxSystemChars ? args.system.slice(-maxSystemChars) : args.system) : "";
  const toGeminiRole = (r: "user" | "assistant") => (r === "assistant" ? "model" : "user");
  const contents = (args.messages || [])
    .filter((m) => String(m?.content || "").trim().length > 0)
    .slice(-16)
    .map((m) => ({
      role: toGeminiRole(m.role),
      parts: [{ text: String(m.content) }],
    }));
  // Gemini REST: models/{model}:generateContent
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(
    args.apiKey
  )}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(system
        ? {
            systemInstruction: {
              parts: [{ text: system }],
            },
          }
        : {}),
      contents,
      generationConfig: {
        temperature: args.temperature,
        topP: args.top_p,
        maxOutputTokens: maxOut,
        responseMimeType: "text/plain",
      },
      ...(args.allowUnsafe
        ? {
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
          }
        : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Gemini error: ${res.status} ${JSON.stringify(data)}`);
  }
  const parts = data?.candidates?.[0]?.content?.parts;
  const textFromParts =
    Array.isArray(parts) ? parts.map((p: any) => p?.text).filter(Boolean).join("\n") : "";
  const functionCalls =
    Array.isArray(parts)
      ? parts
          .map((p: any) => p?.functionCall)
          .filter(Boolean)
          .map((fc: any) => `[functionCall] ${fc?.name || ""} ${fc?.args ? JSON.stringify(fc.args) : ""}`.trim())
          .filter(Boolean)
          .join("\n")
      : "";
  const text =
    textFromParts ||
    functionCalls ||
    (Array.isArray(parts) && parts[0]?.text ? String(parts[0].text) : "") ||
    "";
  return {
    text: text || "",
    raw: data,
    meta: { usedMaxOutputTokens: maxOut, systemChars: system.length, messagesCount: contents.length },
  };
}

function summarizeGeminiEmpty(data: any) {
  const blockReason = data?.promptFeedback?.blockReason || data?.promptFeedback?.blockReasonMessage || "";
  const finishReason = data?.candidates?.[0]?.finishReason || "";
  const safety = data?.candidates?.[0]?.safetyRatings || data?.promptFeedback?.safetyRatings || null;
  const partsCount = Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts.length : 0;
  const firstParts =
    Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts.slice(0, 3)
      : null;
  const hasCandidate = Array.isArray(data?.candidates) && data.candidates.length > 0;
  const candidateKeys = hasCandidate ? Object.keys(data.candidates[0] || {}) : [];
  const contentKeys = data?.candidates?.[0]?.content ? Object.keys(data.candidates[0].content || {}) : [];
  const usage = data?.usageMetadata || null;
  const modelVersion = data?.modelVersion || "";
  return JSON.stringify(
    {
      blockReason,
      finishReason,
      partsCount,
      safety,
      firstParts,
      hasCandidate,
      candidateKeys,
      contentKeys,
      usage,
      modelVersion,
    },
    null,
    2
  );
}

async function callDeepSeek(args: {
  apiKey: string;
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}) {
  // OpenAI-compatible
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature,
      top_p: args.top_p,
      max_tokens: args.max_tokens,
      messages: args.messages,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`DeepSeek error: ${res.status} ${JSON.stringify(data)}`);
  }
  const text = data?.choices?.[0]?.message?.content || "";
  return { text: text || "" };
}

async function loadPananaCharacterBySlug(slug: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("panana_public_characters_v")
    .select(
      "slug, name, handle, hashtags, mbti, intro_title, intro_lines, mood_title, mood_lines, studio_character_id"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        slug: string;
        name: string;
        handle: string | null;
        hashtags: string[] | null;
        mbti: string | null;
        intro_title: string | null;
        intro_lines: string[] | null;
        mood_title: string | null;
        mood_lines: string[] | null;
        studio_character_id: string | null;
      }
    | null;
}

async function loadStudioPrompt(characterId: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from("character_prompts").select("payload").eq("character_id", characterId).maybeSingle();
  if (error) throw error;
  return (data?.payload as any) || null;
}

async function loadStudioLorebook(characterId: string) {
  const supabase = getSupabaseServer();
  // character_id로 직접 걸기 위해 characters를 한 번 더 조회(프로젝트/스코프 조건)
  const { data: cRow, error: cErr } = await supabase.from("characters").select("id, project_id").eq("id", characterId).maybeSingle();
  if (cErr) throw cErr;
  if (!cRow?.project_id) return [];
  const { data, error } = await supabase
    .from("lorebook_entries")
    .select("key, value, sort_order, unlock_type, unlock_affection_min, unlock_expr, unlock_cost_panana, unlock_ending_key, unlock_ep_min, unlock_sku, active")
    .eq("project_id", cRow.project_id)
    .eq("scope", "character")
    .eq("character_id", characterId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as any[];
}

async function loadStudioRules(args: { characterId: string; scope: "project" | "character" | "scene"; sceneId?: string }) {
  const supabase = getSupabaseServer();
  const { data: cRow, error: cErr } = await supabase.from("characters").select("id, project_id").eq("id", args.characterId).maybeSingle();
  if (cErr) throw cErr;
  if (!cRow?.project_id) return null;

  let q = supabase
    .from("trigger_rule_sets")
    .select("payload")
    .eq("project_id", cRow.project_id)
    .eq("scope", args.scope)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (args.scope === "character") q = q.eq("character_id", args.characterId);
  if (args.scope === "scene") q = q.eq("scene_id", String(args.sceneId || ""));

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return (data?.payload as any) || null;
}

function composeSystemPrompt(args: {
  panana?: Awaited<ReturnType<typeof loadPananaCharacterBySlug>>;
  studioPrompt?: any;
  studioLorebook?: Array<{ key: string; value: string }>;
}) {
  const p = args.panana;
  const name = p?.name || "캐릭터";
  const handle = p?.handle ? (p.handle.startsWith("@") ? p.handle : `@${p.handle}`) : "";
  const tags = (p?.hashtags || []).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  const mbti = p?.mbti ? `MBTI: ${p.mbti}` : "";

  const s = args.studioPrompt?.system || {};
  const a = args.studioPrompt?.author || {};
  const few = Array.isArray(s?.fewShotPairs) ? s.fewShotPairs : [];

  const lore = (args.studioLorebook || [])
    .map((x) => `- ${String(x.key)}: ${String(x.value)}`)
    .join("\n");

  const fewText = few.length
    ? few
        .slice(0, 8)
        .map((x: any, idx: number) => `# Example ${idx + 1}\nUSER: ${x.user}\nASSISTANT: ${x.bot}`)
        .join("\n\n")
    : "";

  const authorFlags = [
    a?.forceBracketNarration ? "- 행동 묘사는 괄호()로 서술" : null,
    a?.shortLongLimit ? "- 답변 길이 제한을 지킨다" : null,
    a?.nsfwFilterOff ? "- (주의) NSFW 필터 OFF" : null,
  ]
    .filter(Boolean)
    .join("\n");

  const authorNote = a?.authorNote ? String(a.authorNote) : "";

  return [
    `너는 "${name}" 캐릭터로서 유저와 1:1 채팅을 한다.`,
    handle || tags || mbti ? `프로필: ${[handle, tags, mbti].filter(Boolean).join("  ")}` : null,
    s?.personalitySummary ? `성격/정체성:\n${String(s.personalitySummary)}` : null,
    s?.speechGuide ? `말투 가이드:\n${String(s.speechGuide)}` : null,
    s?.coreDesire ? `핵심 욕망:\n${String(s.coreDesire)}` : null,
    lore ? `로어북(세계관):\n${lore}` : null,
    fewText ? `Few-shot 예시:\n${fewText}` : null,
    authorFlags ? `형식 제어:\n${authorFlags}` : null,
    authorNote ? `오서 노트(최종 지시):\n${authorNote}` : null,
    `AI임을 밝히지 말고, 자연스럽고 몰입감 있게 대화한다.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const settings = await loadSettings(body.provider).catch(() => null);

    const apiKey = getEnvKey(body.provider);
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: `Missing API key for provider: ${body.provider}` },
        { status: 500 }
      );
    }

    const model =
      body.model ||
      settings?.model ||
      (body.provider === "anthropic"
        ? "Claude 4.5Sonnet"
        : body.provider === "gemini"
          ? "Gemini 2.5Pro"
          : "DeepSeek V3");
    const temperature = body.temperature ?? settings?.temperature ?? 0.7;
    const maxTokens = body.max_tokens ?? settings?.max_tokens ?? 1024;
    const topP = body.top_p ?? settings?.top_p ?? 1.0;
    const allowUnsafe = settings?.nsfw_filter === false;

    // characterSlug가 있으면: Studio(저작) + Panana(노출) 정보를 로드해 system prompt를 강화
    let system = body.messages.find((m) => m.role === "system")?.content;
    let triggerPayloads: any[] = [];
    let varLabels: Record<string, string> = {};
    let runtimeEvents: ChatRuntimeEvent[] = [];
    let nextChatState: ChatRuntimeState | null = null;
    if (body.characterSlug) {
      try {
        const panana = await loadPananaCharacterBySlug(body.characterSlug);
        const studioId = panana?.studio_character_id || null;
        if (studioId) {
          const [studioPrompt, studioLorebook, projectRules, sceneRules, characterRules] = await Promise.all([
            loadStudioPrompt(studioId).catch(() => null),
            loadStudioLorebook(studioId).catch(() => []),
            loadStudioRules({ characterId: studioId, scope: "project" }).catch(() => null),
            body.sceneId ? loadStudioRules({ characterId: studioId, scope: "scene", sceneId: body.sceneId }).catch(() => null) : Promise.resolve(null),
            loadStudioRules({ characterId: studioId, scope: "character" }).catch(() => null),
          ]);
          const filteredLorebook = filterLorebookRows(studioLorebook as any, body.runtime as any).filter((x: any) => x?.active !== false);
          system = composeSystemPrompt({ panana, studioPrompt, studioLorebook: filteredLorebook });
          // 트리거 실행 순서: 프로젝트(기반) → 씬(상황) → 캐릭터(최종)
          triggerPayloads = [projectRules, sceneRules, characterRules].filter(Boolean);

          // 콘텐츠별 변수 라벨(선택): project/scene/character 룰 payload에 varLabels가 있으면 합친다(캐릭터 > 씬 > 프로젝트)
          const pLabels = (projectRules as any)?.varLabels;
          const sLabels = (sceneRules as any)?.varLabels;
          const cLabels = (characterRules as any)?.varLabels;
          varLabels = {
            ...(pLabels && typeof pLabels === "object" ? pLabels : {}),
            ...(sLabels && typeof sLabels === "object" ? sLabels : {}),
            ...(cLabels && typeof cLabels === "object" ? cLabels : {}),
          };
        } else if (panana) {
          system = composeSystemPrompt({ panana });
        }
      } catch {
        // ignore: 기존 system 유지
      }
    }
    if (body.concise) {
      const rule = "[응답 규칙] 답변은 한국어로 2~3문장 이내로 짧고 단호하게. 불필요한 설명/장황한 서술 금지.";
      system = system ? `${system}\n\n${rule}` : rule;
    }

    const nonSystem = body.messages.filter((m) => m.role !== "system");

    // ===== Trigger Runtime: rules 평가 → runtime 업데이트 → system events 생성 =====
    const lastUser = [...nonSystem].reverse().find((m) => m.role === "user")?.content || "";
    if (triggerPayloads.length) {
      const prevState: ChatRuntimeState = {
        variables: { ...(((body.runtime as any)?.variables as any) || {}) },
        participants: Array.isArray((body.runtime as any)?.chat?.participants) ? (body.runtime as any).chat.participants : [],
        lastActiveAt: (body.runtime as any)?.chat?.lastActiveAt || null,
        firedAt: ((body.runtime as any)?.chat?.firedAt as any) || {},
      };
      const applied = applyTriggerPayloads({
        now: new Date(),
        userText: String(lastUser || ""),
        state: prevState,
        payloads: triggerPayloads as any,
      });
      nextChatState = applied.state;
      runtimeEvents = applied.events || [];
    }

    // ===== runtime 변수 템플릿 치환 (하위호환: 값이 없으면 원문 유지) =====
    const runtimeVariablesMerged = {
      ...(((body.runtime as any)?.variables as any) || {}),
      ...(nextChatState?.variables || {}),
    };
    const tvars = buildTemplateVars({ runtimeVariables: runtimeVariablesMerged || null });
    if (system) system = interpolateTemplate(system, tvars);
    const nonSystemInterpolated = nonSystem.map((m) => ({ ...m, content: interpolateTemplate(m.content, tvars) }));
    // 트리거/시스템 이벤트에도 템플릿이 섞일 수 있으므로 응답 전에 치환(혹시 남으면 제거)
    if (runtimeEvents.length) {
      runtimeEvents = runtimeEvents.map((e) => {
        if (e.type === "system_message") return { ...e, text: sanitizeAssistantText(e.text, tvars) };
        if (e.type === "unlock_suggest") return { ...e, text: sanitizeAssistantText(e.text, tvars) };
        if (e.type === "reset_offer") return { ...e, text: sanitizeAssistantText(e.text, tvars) };
        if (e.type === "premium_offer") return { ...e, text: sanitizeAssistantText(e.text, tvars) };
        if (e.type === "ep_unlock") return { ...e, text: sanitizeAssistantText(e.text, tvars) };
        return e;
      });
    }

    // system prompt에 현재 상태/이벤트를 추가(LLM이 변수/참여자를 인지하도록)
    if (system) {
      const snapKeys = ["affection", "risk", "trust", "submission", "dependency", "suspicion", "sales", "debt"];
      const snap = snapKeys
        .filter((k) => k in (runtimeVariablesMerged as any))
        .map((k) => `${k}=${String((runtimeVariablesMerged as any)[k])}`)
        .join(", ");
      const parts = (nextChatState?.participants || []).filter(Boolean);
      const eventsText = runtimeEvents
        .filter((e) => e.type === "system_message")
        .map((e) => `- ${String((e as any).text || "")}`)
        .filter(Boolean)
        .join("\n");
      const extra = [
        snap ? `[상태 변수] ${snap}` : null,
        parts.length ? `[참여자] ${parts.join(", ")}` : null,
        eventsText ? `[시스템 이벤트]\n${eventsText}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      if (extra) system = `${system}\n\n${extra}`;
    }

    let out: { text: string; raw?: any; meta?: any };

    if (body.provider === "anthropic") {
      out = await callAnthropic({
        apiKey,
        model,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        system,
        messages: nonSystemInterpolated.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      });
    } else if (body.provider === "gemini") {
      out = await callGemini({
        apiKey,
        model,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        system,
        messages: nonSystemInterpolated.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        allowUnsafe,
      });
    } else {
      out = await callDeepSeek({
        apiKey,
        model,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        messages: [{ role: "system", content: system || "" }, ...nonSystemInterpolated],
      });
    }

    const text = sanitizeAssistantText(String(out.text || ""), tvars);
    if (!text) {
      if (body.provider === "gemini") {
        // 1회 자동 재시도: 시스템/대화 축약 + 텍스트 출력 강제 규칙 추가
        const retryCore = String(system || "").slice(0, 6000);
        const retrySystem = `${retryCore}\n\n[출력 규칙] 반드시 한국어 일반 텍스트로만 답하고, JSON/함수호출/도구출력은 금지한다.`;
        const retryMessages = nonSystem
          .filter((m) => m.role !== "system")
          .slice(-8)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        const retryOut = await callGemini({
          apiKey,
          model,
          temperature,
          max_tokens: Math.min(8192, Math.max(2048, maxTokens * 2)),
          top_p: topP,
          system: retrySystem,
          messages: retryMessages,
          allowUnsafe,
        });
        const retryText = sanitizeAssistantText(String(retryOut.text || ""), tvars);
        if (retryText) {
          return NextResponse.json({ ok: true, provider: body.provider, model, text: retryText });
        }

        const meta = out.meta || {};
        return NextResponse.json(
          {
            ok: false,
            error: `LLM이 빈 응답을 반환했어요. (Gemini)\nmeta=${JSON.stringify(meta)}\n${summarizeGeminiEmpty(out.raw || {})}`,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: false, error: `LLM이 빈 응답을 반환했어요. (provider=${body.provider})` }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      provider: body.provider,
      model,
      text,
      runtime: {
        ...(body.runtime || {}),
        variables: runtimeVariablesMerged,
        chat: nextChatState
          ? {
              participants: nextChatState.participants,
              lastActiveAt: nextChatState.lastActiveAt,
              firedAt: nextChatState.firedAt,
            }
          : (body.runtime as any)?.chat,
        varLabels,
      },
      events: runtimeEvents,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

