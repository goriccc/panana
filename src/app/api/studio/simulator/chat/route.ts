import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { filterLorebookRows } from "@/lib/studio/unlockEngine";
import { buildTemplateVars, interpolateTemplate } from "@/lib/studio/templateRuntime";

export const runtime = "nodejs";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const BodySchema = z.object({
  provider: z.enum(["anthropic", "gemini", "deepseek"]).default("gemini"),
  characterId: z.string().min(1),
  sceneId: z.string().min(1).optional(),
  asCharacterId: z.string().min(1).optional(), // group chat: which character should speak
  messages: z.array(MessageSchema).default([]),
  // optional overrides (otherwise DB settings used)
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().min(1).max(8192).optional(),
  top_p: z.number().min(0).max(1).optional(),
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
    })
    .optional(),
});

function getSupabaseAuthed(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env");

  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing Authorization token");

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function loadSettings(supabase: ReturnType<typeof getSupabaseAuthed>, provider: "anthropic" | "gemini" | "deepseek") {
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
  if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${JSON.stringify(data)}`);
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
  // Gemini 2.5 Pro는 thoughts(생각 토큰)에 출력 예산을 크게 쓰는 경우가 있어,
  // maxOutputTokens가 너무 작으면(content.parts가 비는 형태로) 빈 응답이 발생할 수 있다.
  // 안정성을 위해 최소치를 올린다.
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
        // 텍스트를 강제해서 "content.role만 있고 parts가 비는" 케이스를 최대한 줄인다.
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
  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${JSON.stringify(data)}`);
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
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${args.apiKey}` },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature,
      top_p: args.top_p,
      max_tokens: args.max_tokens,
      messages: args.messages,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`DeepSeek error: ${res.status} ${JSON.stringify(data)}`);
  const text = data?.choices?.[0]?.message?.content || "";
  return { text: text || "" };
}

function rulePayloadToText(payload: any) {
  const rules = Array.isArray(payload?.rules) ? payload.rules : [];
  if (!rules.length) return "";
  return rules
    .slice(0, 20)
    .map((r: any, idx: number) => {
      const name = String(r?.name || `Rule ${idx + 1}`);
      const ifJson = r?.if ? JSON.stringify(r.if) : "";
      const thenJson = r?.then ? JSON.stringify(r.then) : "";
      return `- ${name}\n  IF: ${ifJson}\n  THEN: ${thenJson}`;
    })
    .join("\n");
}

function composeStudioSimSystemPrompt(args: {
  projectTitle: string;
  sceneTitle?: string;
  sceneEpisode?: string;
  characterName: string;
  asCharacterName: string;
  participants: string[];
  prompt?: any;
  projectLorebook: Array<{ key: string; value: string }>;
  characterLorebook: Array<{ key: string; value: string }>;
  sceneLorebook: Array<{ key: string; value: string }>;
  projectRules?: any;
  characterRules?: any;
  sceneRules?: any;
}) {
  const s = args.prompt?.system || {};
  const a = args.prompt?.author || {};
  const few = Array.isArray(s?.fewShotPairs) ? s.fewShotPairs : [];

  const loreToText = (title: string, rows: Array<{ key: string; value: string }>) => {
    if (!rows.length) return "";
    return `${title}:\n` + rows.map((x) => `- ${String(x.key)}: ${String(x.value)}`).join("\n");
  };

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

  const rulesText = [
    args.projectRules ? `프로젝트 룰:\n${rulePayloadToText(args.projectRules)}` : null,
    args.characterRules ? `캐릭터 룰:\n${rulePayloadToText(args.characterRules)}` : null,
    args.sceneRules ? `씬 룰:\n${rulePayloadToText(args.sceneRules)}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    `너는 PananaAI Studio 시뮬레이터다.`,
    `프로젝트: ${args.projectTitle}`,
    args.sceneEpisode || args.sceneTitle ? `씬: ${[args.sceneEpisode, args.sceneTitle].filter(Boolean).join(" · ")}` : null,
    `이 채팅은 테스트용이며, 현재 Draft(초안) 데이터를 기준으로 한다.`,
    `대화 참가자: ${args.participants.length ? args.participants.join(", ") : args.characterName}`,
    `지금 응답할 캐릭터: ${args.asCharacterName}`,
    `응답 규칙: 반드시 "${args.asCharacterName}"의 말투로만 답하고, 3문장 이내로 간결하게.`,
    s?.personalitySummary ? `성격/정체성:\n${String(s.personalitySummary)}` : null,
    s?.speechGuide ? `말투 가이드:\n${String(s.speechGuide)}` : null,
    s?.coreDesire ? `핵심 욕망:\n${String(s.coreDesire)}` : null,
    loreToText("프로젝트 로어북", args.projectLorebook),
    loreToText("캐릭터 로어북", args.characterLorebook),
    loreToText("씬 로어북", args.sceneLorebook),
    rulesText || null,
    fewText ? `Few-shot 예시:\n${fewText}` : null,
    authorFlags ? `형식 제어:\n${authorFlags}` : null,
    authorNote ? `오서 노트:\n${authorNote}` : null,
    `AI임을 밝히지 말고, 자연스럽고 몰입감 있게 대화한다.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const supabase = getSupabaseAuthed(req);

    const settings = await loadSettings(supabase, body.provider).catch(() => null);

    const apiKey = getEnvKey(body.provider);
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: `Missing API key for provider: ${body.provider}` }, { status: 500 });
    }

    const model =
      body.model ||
      settings?.model ||
      (body.provider === "anthropic" ? "Claude 4.5Sonnet" : body.provider === "gemini" ? "Gemini 2.5Pro" : "DeepSeek V3");
    const temperature = body.temperature ?? settings?.temperature ?? 0.7;
    const maxTokens = body.max_tokens ?? settings?.max_tokens ?? 1024;
    const topP = body.top_p ?? settings?.top_p ?? 1.0;

    const { data: c, error: cErr } = await supabase
      .from("characters")
      .select("id, project_id, name")
      .eq("id", body.characterId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!c?.id || !c?.project_id) throw new Error("Character not found");

    const { data: p, error: pErr } = await supabase.from("projects").select("id, title").eq("id", c.project_id).maybeSingle();
    if (pErr) throw pErr;

    const { data: promptRow, error: prErr } = await supabase
      .from("character_prompts")
      .select("payload")
      .eq("character_id", body.characterId)
      .maybeSingle();
    if (prErr) throw prErr;
    const studioPrompt = (promptRow?.payload as any) || null;

    const loadLorebook = async (scope: "project" | "character" | "scene") => {
      let q = supabase
        .from("lorebook_entries")
        .select("key, value, sort_order, unlock_type, unlock_affection_min, unlock_expr, unlock_cost_panana, unlock_ending_key, unlock_ep_min, unlock_sku, active")
        .eq("project_id", c.project_id)
        .eq("scope", scope)
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (scope === "character") q = q.eq("character_id", body.characterId);
      if (scope === "scene") q = q.eq("scene_id", body.sceneId || "");
      const { data, error } = await q;
      if (error) throw error;
      const filtered = filterLorebookRows((data || []) as any, body.runtime as any).filter((x: any) => x?.active !== false);
      return filtered.map((x: any) => ({ key: String(x.key || ""), value: String(x.value || "") })).filter((x: any) => x.key);
    };

    const loadRules = async (scope: "project" | "character" | "scene") => {
      let q = supabase
        .from("trigger_rule_sets")
        .select("payload")
        .eq("project_id", c.project_id)
        .eq("scope", scope)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (scope === "character") q = q.eq("character_id", body.characterId);
      if (scope === "scene") q = q.eq("scene_id", body.sceneId || "");
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return (data?.payload as any) || null;
    };

    const [projectLorebook, characterLorebook, sceneLorebook, projectRules, characterRules, sceneRules] = await Promise.all([
      loadLorebook("project").catch(() => []),
      loadLorebook("character").catch(() => []),
      body.sceneId ? loadLorebook("scene").catch(() => []) : Promise.resolve([]),
      loadRules("project").catch(() => null),
      loadRules("character").catch(() => null),
      body.sceneId ? loadRules("scene").catch(() => null) : Promise.resolve(null),
    ]);

    // participants
    let participants: string[] = [];
    let sceneTitle: string | undefined;
    let sceneEpisode: string | undefined;
    if (body.sceneId) {
      const { data: sMeta } = await supabase
        .from("scenes")
        .select("id, title, episode_label")
        .eq("project_id", c.project_id)
        .eq("id", body.sceneId)
        .maybeSingle();
      sceneTitle = sMeta?.title || undefined;
      sceneEpisode = sMeta?.episode_label || undefined;

      const { data: partRows } = await supabase
        .from("scene_participants")
        .select("character_id, sort_order")
        .eq("scene_id", body.sceneId)
        .order("sort_order", { ascending: true });
      const ids = (partRows || []).map((r: any) => String(r.character_id)).filter(Boolean);
      if (ids.length) {
        const { data: names } = await supabase.from("characters").select("id, name").in("id", ids);
        const map = new Map((names || []).map((r: any) => [String(r.id), String(r.name)] as const));
        participants = ids.map((id) => map.get(id) || id);
      }
    }

    // who speaks
    let asCharacterName = c.name;
    if (body.asCharacterId) {
      const { data: asRow } = await supabase.from("characters").select("id, name").eq("id", body.asCharacterId).maybeSingle();
      if (asRow?.name) asCharacterName = String(asRow.name);
    }

    const system = composeStudioSimSystemPrompt({
      projectTitle: p?.title || "프로젝트",
      sceneTitle,
      sceneEpisode,
      characterName: c.name,
      asCharacterName,
      participants,
      prompt: studioPrompt,
      projectLorebook,
      characterLorebook,
      sceneLorebook,
      projectRules,
      characterRules,
      sceneRules,
    });

    const messages = body.messages || [];

    // ===== runtime 변수 템플릿 치환 (하위호환: 값이 없으면 원문 유지) =====
    const tvars = buildTemplateVars({ runtimeVariables: (body.runtime as any)?.variables || null });
    const systemInterpolated = interpolateTemplate(system, tvars);
    const messagesInterpolated = (messages || []).map((m) => ({ ...m, content: interpolateTemplate(m.content, tvars) }));

    let out: { text: string };
    if (body.provider === "anthropic") {
      out = await callAnthropic({
        apiKey,
        model,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        system: systemInterpolated,
        messages: messagesInterpolated,
      });
    } else if (body.provider === "gemini") {
      out = await callGemini({
        apiKey,
        model,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        system: systemInterpolated,
        messages: messagesInterpolated,
        allowUnsafe: settings?.nsfw_filter === false,
      });
    } else {
      out = await callDeepSeek({
        apiKey,
        model,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        messages: [{ role: "system", content: systemInterpolated }, ...messagesInterpolated],
      });
    }

    const text = String(out.text || "").trim();
    if (!text) {
      // 빈 응답은 대부분 안전필터/차단이므로, 원인 힌트를 포함해 에러로 반환한다.
      if (body.provider === "gemini") {
        // 1회 자동 재시도: 시스템/대화 축약 + 텍스트 출력 강제 규칙 추가
        const retryCore = String(system || "").slice(0, 6000);
        const retrySystem = `${retryCore}\n\n[출력 규칙] 반드시 한국어 일반 텍스트로만 답하고, JSON/함수호출/도구출력은 금지한다.`;
        const retryMessages = (messages || []).slice(-8);
        const retryOut = await callGemini({
          apiKey,
          model,
          temperature,
          max_tokens: Math.min(8192, Math.max(2048, maxTokens * 2)),
          top_p: topP,
          system: retrySystem,
          messages: retryMessages,
          allowUnsafe: settings?.nsfw_filter === false,
        });
        const retryText = String(retryOut.text || "").trim();
        if (retryText) {
          return NextResponse.json({ ok: true, provider: body.provider, model, text: retryText });
        }

        const meta = (retryOut as any)?.meta || (out as any)?.meta || {};
        throw new Error(
          `LLM returned empty text (gemini).\nmeta=${JSON.stringify(meta)}\n${summarizeGeminiEmpty((retryOut as any).raw || (out as any).raw || {})}`
        );
      }
      throw new Error(`LLM returned empty text (${body.provider}).`);
    }

    return NextResponse.json({ ok: true, provider: body.provider, model, text });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 400 });
  }
}

