import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { filterLorebookRows } from "@/lib/studio/unlockEngine";
import { buildTemplateVars, interpolateTemplate } from "@/lib/studio/templateRuntime";
import { applyTriggerPayloads, type ChatRuntimeEvent, type ChatRuntimeState } from "@/lib/studio/chatRuntimeEngine";
import {
  loadMemory,
  updateMemory,
  takeLastNTurns,
  RECENT_TURNS_FOR_LLM,
} from "@/lib/pananaApp/hybridMemory";

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
  // 4) 괄호 지문 안 "유저" → call_sign 치환
  const callSign = String((tvars as any)?.call_sign || (tvars as any)?.user_name || "").trim();
  if (callSign) {
    const replaceInner = (inner: string) => String(inner || "").replace(/(유저|사용자)/g, callSign);
    s = s.replace(/\(([^)]*)\)/g, (_m, inner) => `(${replaceInner(inner)})`);
    s = s.replace(/（([^）]*)）/g, (_m, inner) => `（${replaceInner(inner)}）`);
    s = s.replace(/\[([^\]]*)\]/g, (_m, inner) => `[${replaceInner(inner)}]`);
    s = s.replace(/【([^】]*)】/g, (_m, inner) => `【${replaceInner(inner)}】`);
  }
  // 5) AI가 말 앞에 붙이는 ... 제거
  s = s.replace(/^[\s.]*\.{2,}[\s.]*/g, "").replace(/^[\s]*…[\s]*/g, "");
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
  // (선택) 유저가 ( ) 괄호 안에 입력한 지문(행동/상황 묘사) — 마지막 user 메시지에 주입
  userScript: z.string().min(1).optional(),
  // (선택) 도전 모드: challengeId가 있으면 지문 사용 금지 + 성공 키워드 감지
  challengeId: z.string().uuid().optional(),
  // 프론트 UX 옵션: 응답 길이를 짧게(2~3문장) 유도
  concise: z.boolean().optional(),
  // 홈 "스파이시" 토글이 켜졌을 때 성인 대화 허용을 요청(캐릭터가 지원할 때만 서버가 허용)
  allowUnsafe: z.boolean().optional(),
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

function getSupabaseAdminIfPossible() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
}

/** Gemini 컨텍스트 캐시 이름 보관 (캐시 재사용으로 비용·지연 절감). TTL 55분. */
const geminiCacheStore = new Map<
  string,
  { name: string; hash: string; expiresAt: number }
>();
const GEMINI_CACHE_TTL_MS = 55 * 60 * 1000;

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

async function createGeminiContextCache(
  apiKey: string,
  model: string,
  systemStable: string,
  ttlSeconds = 3600
): Promise<string | null> {
  const modelName = model.startsWith("models/") ? model : `models/${model}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: modelName,
      systemInstruction: { parts: [{ text: systemStable }] },
      ttl: `${ttlSeconds}s`,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  const name = data?.name ? String(data.name) : null;
  return name || null;
}

async function loadChallengeById(challengeId: string): Promise<{
  successKeywords: string[];
  partialMatch: boolean;
  challengeGoal: string;
} | null> {
  const sb = getSupabaseAdminIfPossible();
  if (!sb || !isUuid(challengeId)) return null;
  const { data, error } = await sb
    .from("panana_challenges")
    .select("success_keywords, partial_match, challenge_goal")
    .eq("id", challengeId)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as any).success_keywords;
  let keywords: string[] = Array.isArray(raw) ? raw : [];
  if (keywords.length === 0 && typeof raw === "string" && raw.trim()) {
    keywords = raw.split(/[,;\n]/g).map((x: string) => x.trim()).filter(Boolean);
  }
  const partialMatch = Boolean((data as any).partial_match);
  const challengeGoal = String((data as any).challenge_goal || "").trim();
  return {
    successKeywords: keywords.map((k: string) => String(k || "").trim()).filter(Boolean),
    partialMatch,
    challengeGoal,
  };
}

function removeParenthesisBlocks(s: string): string {
  return String(s || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function checkChallengeSuccess(text: string, keywords: string[], partialMatch: boolean): boolean {
  if (!keywords.length) return false;
  const t = String(text || "").toLowerCase();
  for (const k of keywords) {
    const kw = String(k || "").trim();
    if (!kw) continue;
    const kwLower = kw.toLowerCase();
    if (partialMatch) {
      if (t.includes(kwLower)) return true;
    } else {
      const escaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(?:^|[\\s.,!?~…·。，！？\\n])${escaped}(?:[\\s.,!?~…·。，！？\\n]|$)`);
      if (re.test(t)) return true;
      if (t.includes(kwLower)) return true;
    }
  }
  return false;
}

/** LLM 판사: 성공 키워드가 도전 목표 달성·긍정 맥락에서 사용되었는지 판단. (고백/미션클리어/기타 도전 공통) */
async function judgeChallengeAcceptance(args: {
  aiResponse: string;
  lastUserMessage: string;
  keywords: string[];
  challengeGoal: string;
  recentHistory?: Array<{ role: string; content: string }>;
}): Promise<boolean> {
  const apiKey = getEnvKey("anthropic");
  if (!apiKey) return false;
  const historyLines = (args.recentHistory || [])
    .slice(-6)
    .map((m) => `${m.role === "user" ? "유저" : "캐릭터"}: ${String(m.content || "").slice(0, 150)}`)
    .join("\n");
  const goalText = args.challengeGoal ? `도전 목표: ${args.challengeGoal}\n\n` : "";
  const prompt = `[도전 모드 성공 판정 - 유저 경쟁용, 도전 유형 무관 공통 규칙]
캐릭터 최신 응답에 성공 키워드가 포함되어 있다. "도전 목표 달성" 또는 "성공 키워드를 긍정·수락·달성 맥락에서 사용"했으면 예, 부정·반어·거절 맥락이면 아니오.

${goalText}${historyLines ? `[최근 대화]\n${historyLines}\n\n` : ""}캐릭터 최신 응답: "${String(args.aiResponse || "").slice(0, 500)}"
성공 키워드: ${(args.keywords || []).slice(0, 8).join(", ")}

판정 기준 (어떤 도전이든 동일):
- 캐릭터가 목표를 달성했거나 성공 키워드를 긍정적으로 사용(수락·동의·달성·승리·클리어 등)했으면 → 예
- 캐릭터가 키워드를 부정·반어·회피로 사용(거절·반박·"아니야"·"그건 아님" 등)했으면 → 아니오
- 애매하면 예. 한 줄로 "예" 또는 "아니오"만 답하시오.`;
  try {
    const out = await callAnthropic({
      apiKey,
      model: "claude-haiku-4-5",
      temperature: 0,
      max_tokens: 16,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = String(out.text || "").trim();
    const firstLine = (raw.split(/\r?\n/)[0]?.trim() || raw).slice(0, 50);
    const positive = /(예|네|yes|성공|긍정|o\b|y\b|accept|true)/i.test(firstLine);
    const negative = /(아니오|no\s*$|거절|reject|false)/i.test(firstLine) || /\bno\b/i.test(firstLine);
    return positive && !negative;
  } catch {
    return false;
  }
}

async function fetchAdultVerified(pananaId: string) {
  const sbAdmin = getSupabaseAdminIfPossible();
  if (!sbAdmin || !isUuid(pananaId)) return false;
  try {
    const { data, error } = await sbAdmin
      .from("panana_users")
      .select("adult_verified")
      .eq("id", pananaId)
      .maybeSingle();
    if (error) return false;
    return Boolean((data as any)?.adult_verified);
  } catch {
    return false;
  }
}

async function fetchProfileNote(pananaId: string): Promise<string | null> {
  const sbAdmin = getSupabaseAdminIfPossible();
  if (!sbAdmin || !isUuid(pananaId)) return null;
  try {
    const { data, error } = await sbAdmin
      .from("panana_users")
      .select("profile_note")
      .eq("id", pananaId)
      .maybeSingle();
    if (error) return null;
    const note = (data as any)?.profile_note;
    return note != null && String(note).trim() ? String(note).trim() : null;
  } catch {
    return null;
  }
}

async function loadFallbackProvider(): Promise<"anthropic" | "gemini" | "deepseek" | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("panana_public_site_settings_v")
    .select("llm_fallback_provider")
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const p = (data as any)?.llm_fallback_provider;
  if (p === "anthropic" || p === "gemini" || p === "deepseek") return p;
  return null;
}

function isAnthropicContentPolicyError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /content\s*filtering|output\s*blocked|content\s*policy/i.test(msg);
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

/** 대화 깊이/맥락 복잡도에 따라 Gemini Flash(가벼운 대화) vs Pro(복잡·정교한 서사) 자동 선택 */
function selectGeminiModel(
  messages: Array<{ role: string; content: string }>,
  system: string
): string {
  const totalChars =
    (system?.length || 0) + (messages || []).reduce((sum, m) => sum + (m?.content?.length || 0), 0);
  const msgCount = (messages || []).length;
  const lastAssistant = [...(messages || [])]
    .reverse()
    .find((m) => m.role === "assistant")
    ?.content?.length || 0;
  if (totalChars > 12000 || msgCount > 10 || lastAssistant > 400) return "gemini-2.5-pro";
  return "gemini-2.5-flash";
}

/** 문장·맥락에 따라 Claude Haiku(짧거나 단순) vs Sonnet(그 외) 자동 선택 */
function selectAnthropicModel(
  messages: Array<{ role: string; content: string }>,
  system: string
): string {
  const totalChars =
    (system?.length || 0) + (messages || []).reduce((sum, m) => sum + (m?.content?.length || 0), 0);
  const msgCount = (messages || []).length;
  const lastAssistant = [...(messages || [])]
    .reverse()
    .find((m) => m.role === "assistant")
    ?.content?.length || 0;
  if (totalChars > 12000 || msgCount > 10 || lastAssistant > 400) return "claude-sonnet-4-5";
  return "claude-haiku-4-5";
}

function toGeminiApiModel(displayOrApi: string): string {
  const v = String(displayOrApi || "").trim().toLowerCase();
  if (v.includes("2.5-pro") || v.includes("pro")) return "gemini-2.5-pro";
  if (v.includes("2.5-flash") || v.includes("flash")) return "gemini-2.5-flash";
  return v.startsWith("gemini-") ? v : "gemini-2.5-flash";
}

/** Anthropic 프롬프트 캐싱: 고정 영역(캐릭터+프로필+요약) 캐시, 변동 영역(시각/상태/이벤트)은 매번 전송 → 비용·지연 절감 */
const ANTHROPIC_PROMPT_CACHING_BETA = "prompt-caching-2024-07-31";

async function callAnthropic(args: {
  apiKey: string;
  model: string;
  temperature: number;
  max_tokens: number;
  top_p?: number;
  messages: { role: "user" | "assistant"; content: string }[];
  system?: string;
  /** 캐싱 사용 시: 캐시할 고정 시스템 프롬프트(캐릭터·유저 프로필·지난 서사 등) */
  systemCacheable?: string;
  /** 캐싱 사용 시: 매 턴 바뀌는 부분(현재 시각·상태 변수·이벤트). systemCacheable과 둘 다 있으면 캐싱 적용 */
  systemVariable?: string;
}) {
  const usePromptCaching =
    !!args.systemCacheable &&
    args.systemCacheable.length > 0 &&
    !!args.systemVariable;

  const systemPayload = usePromptCaching
    ? [
        { type: "text" as const, text: args.systemCacheable!, cache_control: { type: "ephemeral" as const } },
        { type: "text" as const, text: args.systemVariable! },
      ]
    : args.system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01",
      ...(usePromptCaching ? { "anthropic-beta": ANTHROPIC_PROMPT_CACHING_BETA } : {}),
    },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature,
      max_tokens: args.max_tokens,
      system: systemPayload,
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
  /** 컨텍스트 캐싱: 캐시된 시스템 대신 사용할 캐시 이름 (cachedContents/xxx) */
  cachedContentName?: string | null;
  /** 캐싱 사용 시: 매 턴 바뀌는 시스템 블록(현재 시각·상태·이벤트). contents 맨 앞에 user 메시지로 넣음 */
  systemVariable?: string;
}) {
  let maxOut = Number.isFinite(args.max_tokens) ? Math.max(16, Math.floor(args.max_tokens)) : 1024;
  if (/gemini-2\.5-pro/i.test(args.model)) {
    maxOut = Math.max(maxOut, 2048);
  }
  const maxSystemChars = 16000;
  const system = args.system ? (args.system.length > maxSystemChars ? args.system.slice(-maxSystemChars) : args.system) : "";
  const toGeminiRole = (r: "user" | "assistant") => (r === "assistant" ? "model" : "user");
  const messagesTrimmed = (args.messages || [])
    .filter((m) => String(m?.content || "").trim().length > 0)
    .slice(-16);
  const contentsBase = messagesTrimmed.map((m) => ({
    role: toGeminiRole(m.role),
    parts: [{ text: String(m.content) }],
  }));
  const useCache = !!args.cachedContentName && args.cachedContentName.length > 0;
  const contents = useCache && args.systemVariable?.trim()
    ? [{ role: "user" as const, parts: [{ text: args.systemVariable.trim() }] }, ...contentsBase]
    : contentsBase;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(
    args.apiKey
  )}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(useCache ? { cachedContent: args.cachedContentName } : {}),
      ...(!useCache && system
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
    meta: { usedMaxOutputTokens: maxOut, systemChars: system.length, messagesCount: contents.length, usedContextCache: useCache },
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
  // 하위호환: safety_supported, profile_image_url 컬럼/뷰가 아직 없을 수 있음 → fallback select
  const trySelect = async (withSafety: boolean, withProfileImage: boolean) => {
    let select = "slug, name, handle, hashtags, mbti, intro_title, intro_lines, mood_title, mood_lines, studio_character_id";
    if (withSafety) select += ", safety_supported";
    if (withProfileImage) select += ", profile_image_url";
    return await supabase.from("panana_public_characters_v").select(select).eq("slug", slug).maybeSingle();
  };

  let first = await trySelect(true, true);
  if (first.error) {
    const msg = String((first.error as any)?.message || "");
    if (msg.includes("safety_supported") || msg.includes("profile_image_url")) {
      first = await trySelect(false, false);
      if (first.error) throw first.error;
    } else {
      throw first.error;
    }
  }
  return first.data as
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
        safety_supported?: boolean | null;
        profile_image_url?: string | null;
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

async function resolveSceneId(args: { supabase: ReturnType<typeof getSupabaseServer>; projectId: string; sceneId?: string }) {
  const raw = String(args.sceneId || "").trim();
  if (!raw) return "";
  if (isUuid(raw)) return raw;
  const { data, error } = await args.supabase.from("scenes").select("id").eq("project_id", args.projectId).eq("slug", raw).maybeSingle();
  if (error) return "";
  return String((data as any)?.id || "");
}

async function loadStudioSceneLorebook(args: { characterId: string; sceneId?: string }) {
  const supabase = getSupabaseServer();
  const { data: cRow, error: cErr } = await supabase.from("characters").select("id, project_id").eq("id", args.characterId).maybeSingle();
  if (cErr) throw cErr;
  if (!cRow?.project_id) return [];
  const sceneId = await resolveSceneId({ supabase, projectId: String(cRow.project_id), sceneId: args.sceneId });
  if (!sceneId) return [];
  const { data, error } = await supabase
    .from("lorebook_entries")
    .select("key, value, sort_order, unlock_type, unlock_affection_min, unlock_expr, unlock_cost_panana, unlock_ending_key, unlock_ep_min, unlock_sku, active")
    .eq("project_id", cRow.project_id)
    .eq("scope", "scene")
    .eq("scene_id", sceneId)
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
  if (args.scope === "scene") {
    const sceneId = await resolveSceneId({ supabase, projectId: String(cRow.project_id), sceneId: args.sceneId });
    if (!sceneId) return null;
    q = q.eq("scene_id", sceneId);
  }

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
  const tags = (p?.hashtags || []).map((t: string) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
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

  // forceBracketNarration이 명시적으로 false가 아니면 괄호 지문 지시 포함(미설정 시 기본 적용)
  const authorFlags = [
    a?.forceBracketNarration !== false ? "- 행동 묘사는 괄호()로 서술" : null,
    a?.shortLongLimit ? "- 답변 길이 제한을 지킨다" : null,
    a?.nsfwFilterOff ? "- (주의) NSFW 필터 OFF" : null,
  ]
    .filter(Boolean)
    .join("\n");

  const authorNote = a?.authorNote ? String(a.authorNote) : "";

  return [
    `너는 "${name}" 캐릭터로서 "{{call_sign}}"(상대방)과 기본은 1:1로 대화하되, 참여자가 추가되면 1:N 그룹 대화로 전환한다.`,
    `상대방을 "유저"라고 부르지 말고, 반드시 "{{call_sign}}" 또는 상황에 맞는 호칭으로 부른다.`,
    `지문(괄호 안 서술)에서도 "유저/사용자" 금지. 반드시 "{{call_sign}}"으로 표기한다.`,
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

    let model =
      body.model ||
      settings?.model ||
      (body.provider === "anthropic"
        ? "claude-sonnet-4-5"
        : body.provider === "gemini"
          ? "gemini-2.5-pro"
          : "DeepSeek V3");
    // Anthropic deprecated/legacy Sonnet IDs → 현재 지원 모델 (404 방지)
    if (body.provider === "anthropic" && /claude-3-5-sonnet-(20241022|latest)/i.test(model)) {
      model = "claude-sonnet-4-5";
    }
    // "auto"는 아래에서 system 확정 후 selectAnthropicModel로 치환됨
    const temperature = body.temperature ?? settings?.temperature ?? 0.7;
    const maxTokens = body.max_tokens ?? settings?.max_tokens ?? 1024;
    const topP = body.top_p ?? settings?.top_p ?? 1.0;
    // allowUnsafe 기본값은 운영 설정(nsfw_filter=false)이며,
    // 유저가 홈에서 스파이시 토글을 켠 경우(body.allowUnsafe=true)라도 캐릭터가 safety_supported=true일 때만 허용한다.
    let allowUnsafe = settings?.nsfw_filter === false;
    const pananaIdFromRuntime = String((body.runtime as any)?.variables?.panana_id || "").trim();
    let adultVerified = false;

    // characterSlug가 있으면: Studio(저작) + Panana(노출) 정보를 로드해 system prompt를 강화
    let system = body.messages.find((m) => m.role === "system")?.content;
    let triggerPayloads: any[] = [];
    let varLabels: Record<string, string> = {};
    let runtimeEvents: ChatRuntimeEvent[] = [];
    let nextChatState: ChatRuntimeState | null = null;
    let panana: Awaited<ReturnType<typeof loadPananaCharacterBySlug>> = null;
    if (body.characterSlug) {
      try {
        panana = await loadPananaCharacterBySlug(body.characterSlug);
        if (body.allowUnsafe && panana && Boolean((panana as any)?.safety_supported)) {
          allowUnsafe = true;
        }
        const studioId = panana?.studio_character_id || null;
        if (studioId) {
          const [studioPrompt, studioLorebook, sceneLorebook, projectRules, sceneRules, characterRules] = await Promise.all([
            loadStudioPrompt(studioId).catch(() => null),
            loadStudioLorebook(studioId).catch(() => []),
            body.sceneId ? loadStudioSceneLorebook({ characterId: studioId, sceneId: body.sceneId }).catch(() => []) : Promise.resolve([]),
            loadStudioRules({ characterId: studioId, scope: "project" }).catch(() => null),
            body.sceneId ? loadStudioRules({ characterId: studioId, scope: "scene", sceneId: body.sceneId }).catch(() => null) : Promise.resolve(null),
            loadStudioRules({ characterId: studioId, scope: "character" }).catch(() => null),
          ]);

          // Studio 설정(nsfwFilterOff) → Panana 노출 플래그(safety_supported) 자동 동기화
          // - 홈 스파이시 필터가 DB 플래그를 보므로, 드리프트가 있으면 서버에서 바로 맞춰준다.
          const nsfwFilterOff = Boolean((studioPrompt as any)?.author?.nsfwFilterOff);
          if (body.allowUnsafe && nsfwFilterOff) {
            allowUnsafe = true;
          }
          const currentSafety = Boolean((panana as any)?.safety_supported);
          if (nsfwFilterOff !== currentSafety) {
            const sbAdmin = getSupabaseAdminIfPossible();
            if (sbAdmin) {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              sbAdmin.from("panana_characters").update({ safety_supported: nsfwFilterOff }).eq("studio_character_id", studioId);
            }
          }

          const mergedLorebook = [...(studioLorebook as any[]), ...(sceneLorebook as any[])]
            .filter(Boolean)
            .sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
          const filteredLorebook = filterLorebookRows(mergedLorebook as any, body.runtime as any).filter((x: any) => x?.active !== false);
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
    if (allowUnsafe || body.allowUnsafe) {
      adultVerified = await fetchAdultVerified(pananaIdFromRuntime);
      if (!adultVerified) {
        allowUnsafe = false;
      }
    }
    if (body.concise) {
      const rule = "[응답 규칙] 답변은 한국어로 2~3문장 이내로 짧고 단호하게. 불필요한 설명/장황한 서술 금지.";
      system = system ? `${system}\n\n${rule}` : rule;
    }

    let challengeMeta: { successKeywords: string[]; partialMatch: boolean; challengeGoal: string } | null = null;
    if (body.challengeId) {
      challengeMeta = await loadChallengeById(body.challengeId);
      // 지문(괄호) 금지 규칙 제거: LLM은 자유롭게 지문 포함 출력, 후처리(removeParenthesisBlocks)로 괄호 제거
      // 성공 판정은 괄호 제거 후 대화 텍스트에만 적용(checkChallengeSuccess)
      const kwList = (challengeMeta?.successKeywords || []).filter(Boolean).join(", ");
      const kwHint = kwList
        ? `다음 표현은 대화가 충분히 진행된 후에만 사용한다: ${kwList}. 초반에는 절대 사용하지 않는다. `
        : "";
      const challengeBlock = `[도전 모드] 이 대화는 도전 모드이다. 당신은 쉽게 마음을 열지 않는다. ${kwHint}유저가 초반에 고백·사랑 표현·결정적 키워드를 해도 당황하거나 회피하거나 부담스러워하며 거절·무시·주제 전환한다. 대화가 자연스럽게 깊어지고 분위기가 무르익은 후에만 진심을 받아들일 수 있다.
[도전 모드 출력 규칙] 지문(괄호 안 행동·상황 묘사)을 넣지 말고 대사만 쓴다. 문장을 중간에 끊지 말고 반드시 끝까지 완성한 뒤 마침표로 마친다.`;
      system = system ? `${system}\n\n${challengeBlock}` : challengeBlock;
    }

    if (pananaIdFromRuntime) {
      const profileNote = await fetchProfileNote(pananaIdFromRuntime);
      if (profileNote) {
        const block = `\n\n[유저가 알려준 자신에 대한 정보]\n${profileNote}`;
        system = system ? `${system}${block}` : block.trim();
      }
      // 하이브리드 메모리: [유저 프로필] + [지난 서사] (장기 기억) 주입
      if (body.characterSlug && isUuid(pananaIdFromRuntime)) {
        const sbAdminMem = getSupabaseAdminIfPossible();
        if (sbAdminMem) {
          const mem = await loadMemory(sbAdminMem, pananaIdFromRuntime, body.characterSlug);
          if (mem && (mem.profileBlock || mem.summariesBlock)) {
            const blocks = [mem.profileBlock, mem.summariesBlock].filter(Boolean).join("\n\n");
            if (blocks) system = system ? `${blocks}\n\n---\n\n${system}` : blocks;
          }
        }
      }
    }

    const nonSystem = body.messages.filter((m) => m.role !== "system");
    const userTurns = nonSystem.filter((m) => m.role === "user").length;

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

    // ===== UX: 초반(첫 턴) 로어북/합류/획득 같은 시스템 이벤트가 즉시 튀어나오면 몰입이 깨짐 =====
    // - 상태(state)는 적용하되(events로 반영된 participants/variables 포함),
    // - 화면 노출/프롬프트 주입용 이벤트는 2턴부터만 보여준다.
    if (userTurns <= 1 && runtimeEvents.length) {
      runtimeEvents = runtimeEvents.filter((e) => e.type === "var_delta"); // 첫 턴에는 var 변화도 보통 불필요하지만, 필요 시만 남김
      // 기본 정책: 첫 턴에는 이벤트를 아예 숨김(가장 자연스러움)
      runtimeEvents = [];
    }

    // ===== runtime 변수 템플릿 치환 (하위호환: 값이 없으면 원문 유지) =====
    const runtimeVariablesMerged = {
      ...(((body.runtime as any)?.variables as any) || {}),
      ...(nextChatState?.variables || {}),
    };
    const tvars = buildTemplateVars({ runtimeVariables: runtimeVariablesMerged || null });
    if (system) system = interpolateTemplate(system, tvars);
    let nonSystemInterpolated = nonSystem.map((m) => ({ ...m, content: interpolateTemplate(m.content, tvars) }));
    // 하이브리드 메모리: [유저 프로필]/[지난 서사]가 있으면 최근 N턴만 LLM에 전달 (토큰 절약 + 호흡 유지)
    const hasMemory =
      !!(
        pananaIdFromRuntime &&
        body.characterSlug &&
        isUuid(pananaIdFromRuntime) &&
        (system?.includes("[유저 프로필]") || system?.includes("[우리의 지난 서사]"))
      );
    if (hasMemory) {
      const asMemory = nonSystemInterpolated.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      nonSystemInterpolated = takeLastNTurns(asMemory, RECENT_TURNS_FOR_LLM);
    }
    // 유저 지문(( ) 괄호 입력): 마지막 user 메시지 앞에 주입
    const userScript = body.challengeId ? "" : String((body as any).userScript || "").trim();
    if (userScript) {
      const lastIdx = nonSystemInterpolated.map((m) => m.role).lastIndexOf("user");
      if (lastIdx >= 0) {
        const last = nonSystemInterpolated[lastIdx];
        const injected = `[유저 지문(이번 턴 행동/상황 묘사)] ${userScript}\n\n[유저 메시지] ${last.content}`;
        nonSystemInterpolated = nonSystemInterpolated.map((m, i) =>
          i === lastIdx ? { ...m, content: injected } : m
        );
      }
    }
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

    // system prompt에 현재 시각(KST)·상태/이벤트를 추가 (변동 영역 = 캐싱 제외)
    let systemStableForCache: string | undefined;
    let systemVariablePart: string | undefined;
    if (system) {
      const nowKst = new Date().toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const currentTimeBlock = `[현재 시각] ${nowKst} (한국 표준시 KST). 유저가 시간·날짜를 물어보면 이 시각을 기준으로 답한다.`;
      const snapKeys = [
        "affection",
        "risk",
        "stress",
        "alcohol",
        "jealousy",
        "performance",
        "fatigue",
        "trust",
        "submission",
        "dependency",
        "suspicion",
        "sales",
        "debt",
        "location",
        "time",
      ];
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
      const hasSceneShift = runtimeEvents.some(
        (e) => e.type === "system_message" && String((e as any).text || "").includes("[씬 전환]")
      );
      const extra = [
        currentTimeBlock,
        snap ? `[상태 변수] ${snap}` : null,
        parts.length ? `[참여자] ${parts.join(", ")}` : null,
        eventsText ? `[시스템 이벤트]\n${eventsText}` : null,
        hasSceneShift
          ? `[연출] 방금 씬이 전환되었다. 다음 답변의 첫 문장에서 장소/상황 변화를 자연스럽게 드러내고 이어서 캐릭터 대사로 진행한다.`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
      if (extra) {
        systemStableForCache = system;
        systemVariablePart = extra;
        system = `${system}\n\n${extra}`;
      }
    }

    let out: { text: string; raw?: any; meta?: any };

    // Gemini: model이 "auto"이거나 없으면 대화 복잡도에 따라 Flash vs Pro 자동 선택. 그 외에는 지정 모델 사용.
    if (body.provider === "gemini") {
      model =
        body.model && body.model !== "auto"
          ? toGeminiApiModel(body.model)
          : selectGeminiModel(
              nonSystemInterpolated.map((m) => ({ role: m.role, content: m.content })),
              system || ""
            );
    }

    // Anthropic: model이 "auto"이면 문장·맥락에 따라 Haiku(짧/단순) vs Sonnet(그 외) 자동 선택
    if (body.provider === "anthropic" && model === "auto") {
      model = selectAnthropicModel(
        nonSystemInterpolated.map((m) => ({ role: m.role, content: m.content })),
        system || ""
      );
    }

    if (body.provider === "anthropic") {
      try {
        out = await callAnthropic({
          apiKey,
          model,
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          system,
          ...(systemStableForCache != null &&
          systemVariablePart != null &&
          systemStableForCache.length > 0
            ? { systemCacheable: systemStableForCache, systemVariable: systemVariablePart }
            : {}),
          messages: nonSystemInterpolated.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        });
      } catch (anthropicErr) {
        if (allowUnsafe && isAnthropicContentPolicyError(anthropicErr)) {
          const fallback = await loadFallbackProvider();
          if (fallback === "gemini") {
            const geminiKey = getEnvKey("gemini");
            const geminiSettings = await loadSettings("gemini").catch(() => null);
            if (geminiKey) {
              const fallbackModel = selectGeminiModel(
                nonSystemInterpolated.map((m) => ({ role: m.role, content: m.content })),
                system || ""
              );
              out = await callGemini({
                apiKey: geminiKey,
                model: fallbackModel,
                temperature: geminiSettings?.temperature ?? 0.7,
                max_tokens: geminiSettings?.max_tokens ?? maxTokens,
                top_p: geminiSettings?.top_p ?? topP,
                system,
                messages: nonSystemInterpolated.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
                allowUnsafe: true,
              });
            } else {
              throw anthropicErr;
            }
          } else {
            throw anthropicErr;
          }
        } else {
          throw anthropicErr;
        }
      }
    } else if (body.provider === "gemini") {
      let geminiCachedName: string | null = null;
      if (
        systemStableForCache != null &&
        systemVariablePart != null &&
        systemStableForCache.length > 0 &&
        pananaIdFromRuntime &&
        body.characterSlug &&
        isUuid(pananaIdFromRuntime)
      ) {
        const cacheKey = `${pananaIdFromRuntime}:${body.characterSlug}`;
        const hash = simpleHash(systemStableForCache);
        const entry = geminiCacheStore.get(cacheKey);
        const now = Date.now();
        if (entry && entry.hash === hash && entry.expiresAt > now) {
          geminiCachedName = entry.name;
        } else {
          const name = await createGeminiContextCache(apiKey, model, systemStableForCache, 3600);
          if (name) {
            geminiCachedName = name;
            geminiCacheStore.set(cacheKey, {
              name,
              hash,
              expiresAt: now + GEMINI_CACHE_TTL_MS,
            });
          }
        }
      }
      out = await callGemini({
        apiKey,
        model,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        system,
        messages: nonSystemInterpolated.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        allowUnsafe,
        ...(geminiCachedName
          ? {
              cachedContentName: geminiCachedName,
              systemVariable: systemVariablePart ?? "",
            }
          : {}),
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

    let text = sanitizeAssistantText(String(out.text || ""), tvars);
    if (challengeMeta) {
      text = removeParenthesisBlocks(text);
    }
    const minTurnsForSuccess = 4;
    const keywordMatch =
      challengeMeta &&
      challengeMeta.successKeywords.length > 0 &&
      userTurns >= minTurnsForSuccess &&
      checkChallengeSuccess(text, challengeMeta.successKeywords, challengeMeta.partialMatch);

    let challengeSuccess = false;
    if (keywordMatch) {
      const lastUserMsg = [...nonSystem].reverse().find((m) => m.role === "user")?.content || "";
      const recentHistory = nonSystem.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      challengeSuccess = await judgeChallengeAcceptance({
        aiResponse: text,
        lastUserMessage: lastUserMsg,
        keywords: challengeMeta!.successKeywords,
        challengeGoal: challengeMeta!.challengeGoal || "",
        recentHistory,
      });
    }

    // 하이브리드 메모리: 응답 후 요약(20턴마다)·프로필 추출 업데이트 (비동기 실패해도 응답은 반환)
    if (pananaIdFromRuntime && body.characterSlug && isUuid(pananaIdFromRuntime)) {
      const sbAdminUp = getSupabaseAdminIfPossible();
      const geminiKey = getEnvKey("gemini");
      if (sbAdminUp && geminiKey) {
        const fullForMemory = [
          ...nonSystemInterpolated.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "assistant" as const, content: text },
        ];
        const totalUserTurnsInThread = typeof (body.runtime as any)?.variables?.total_user_turns_in_thread === "number"
          ? (body.runtime as any).variables.total_user_turns_in_thread
          : undefined;
        void updateMemory(sbAdminUp, pananaIdFromRuntime, body.characterSlug, fullForMemory, geminiKey, totalUserTurnsInThread).catch(() => {});
      }
    }

    if (!text) {
      if (body.provider === "gemini") {
        // 1회 자동 재시도: 시스템/대화 축약 + 텍스트 출력 강제 규칙 추가. 도전 모드는 턴 수 많을 때 빈 응답 많아서 재시도 시 더 짧게
        const isChallenge = !!body.challengeId;
        const retrySystemMax = isChallenge ? 4000 : 6000;
        const retryCore = String(system || "").slice(0, retrySystemMax);
        const retrySystem = `${retryCore}\n\n[출력 규칙] 반드시 한국어 일반 텍스트로만 답하고, JSON/함수호출/도구출력은 금지한다.`;
        const retryMsgLimit = isChallenge ? 12 : 8;
        const retryMessages = nonSystem
          .filter((m) => m.role !== "system" && String(m.content || "").trim().length > 0)
          .slice(-retryMsgLimit)
          .map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content || "").trim() }));
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
      ...(body.challengeId ? { challengeSuccess } : {}),
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
    const msg = e?.message || "Unknown error";
    const zodIssues = Array.isArray((e as any)?.issues) ? JSON.stringify((e as any).issues) : "";
    const full = zodIssues ? `${msg} [Zod: ${zodIssues}]` : msg;
    return NextResponse.json({ ok: false, error: full }, { status: 400 });
  }
}

