export type AirportPref = {
  purpose: string;
  mood: string;
  characterType: string;
};

export type PreferenceMappingGroup = Record<string, { weight: number; tags: string[] }>;

export type RecommendationSettings = {
  mapping: {
    purpose: PreferenceMappingGroup;
    mood: PreferenceMappingGroup;
    characterType: PreferenceMappingGroup;
  };
  behaviorWeights: {
    click: number;
    chatStart: number;
    favorite: number;
  };
  cacheTtlSec: number;
  ab: {
    enabled: boolean;
    ratioB: number;
  };
  popular: {
    days: number;
    recentDays: number;
    msgWeight: number;
    recentWeight: number;
    userWeight: number;
    recencyWeight: number;
    cacheTtlSec: number;
  };
};

export const defaultRecommendationSettings: RecommendationSettings = {
  mapping: {
    purpose: {
      spark: { weight: 2, tags: ["#설렘", "#로맨스", "#두근"] },
      comfort: { weight: 2, tags: ["#위로", "#힐링", "#다정"] },
      spicy: { weight: 2, tags: ["#자극", "#스파이시", "#19", "#농밀"] },
      real: { weight: 2, tags: ["#현실", "#현실연애", "#일상"] },
      light: { weight: 2, tags: ["#가볍게", "#캐주얼", "#즐거움"] },
    },
    mood: {
      sweet: { weight: 1.5, tags: ["#달달", "#설렘", "#로맨틱"] },
      calm: { weight: 1.5, tags: ["#차분", "#힐링", "#잔잔"] },
      playful: { weight: 1.5, tags: ["#장난", "#유쾌", "#티키타카"] },
      tense: { weight: 1.5, tags: ["#긴장", "#미스터리", "#서스펜스"] },
      intense: { weight: 1.5, tags: ["#강렬", "#직진", "#자극"] },
    },
    characterType: {
      gentle: { weight: 1.2, tags: ["#다정", "#따뜻", "#배려"] },
      care: { weight: 1.2, tags: ["#무심", "#츤데레", "#챙김"] },
      confident: { weight: 1.2, tags: ["#자신감", "#직진", "#리드"] },
      mystery: { weight: 1.2, tags: ["#미스터리", "#비밀", "#차가움"] },
      cute: { weight: 1.2, tags: ["#귀여움", "#애교", "#사랑스러움"] },
    },
  },
  behaviorWeights: {
    click: 0.6,
    chatStart: 1.4,
    favorite: 2.2,
  },
  cacheTtlSec: 3600,
  ab: {
    enabled: true,
    ratioB: 0.5,
  },
  popular: {
    days: 30,
    recentDays: 7,
    msgWeight: 0.4,
    recentWeight: 0.8,
    userWeight: 2.0,
    recencyWeight: 1.0,
    cacheTtlSec: 600,
  },
};

const LS_BEHAVIOR = "panana_behavior_scores_v1";
const LS_AB = "panana_reco_ab_v1";
const LS_CACHE = "panana_reco_cache_v1";

export function normalizeTag(tag: string) {
  return String(tag || "").replace(/^#/, "").trim().toLowerCase();
}

export function mergeRecommendationSettings(input?: Partial<RecommendationSettings> | null): RecommendationSettings {
  const base = defaultRecommendationSettings;
  if (!input) return base;
  return {
    mapping: {
      purpose: { ...base.mapping.purpose, ...(input.mapping?.purpose || {}) },
      mood: { ...base.mapping.mood, ...(input.mapping?.mood || {}) },
      characterType: { ...base.mapping.characterType, ...(input.mapping?.characterType || {}) },
    },
    behaviorWeights: { ...base.behaviorWeights, ...(input.behaviorWeights || {}) },
    cacheTtlSec: Math.max(60, Number(input.cacheTtlSec || base.cacheTtlSec)),
    ab: {
      enabled: input.ab?.enabled ?? base.ab.enabled,
      ratioB: Math.min(1, Math.max(0, Number(input.ab?.ratioB ?? base.ab.ratioB))),
    },
    popular: {
      days: Math.max(7, Math.min(120, Number(input.popular?.days ?? base.popular.days))),
      recentDays: Math.max(1, Math.min(30, Number(input.popular?.recentDays ?? base.popular.recentDays))),
      msgWeight: Number(input.popular?.msgWeight ?? base.popular.msgWeight),
      recentWeight: Number(input.popular?.recentWeight ?? base.popular.recentWeight),
      userWeight: Number(input.popular?.userWeight ?? base.popular.userWeight),
      recencyWeight: Number(input.popular?.recencyWeight ?? base.popular.recencyWeight),
      cacheTtlSec: Math.max(60, Number(input.popular?.cacheTtlSec ?? base.popular.cacheTtlSec)),
    },
  };
}

export function buildAnswerSignals(pref: AirportPref | null, mapping: RecommendationSettings["mapping"]) {
  if (!pref) return [];
  const out: Array<{ tag: string; weight: number }> = [];
  const purpose = mapping.purpose[pref.purpose];
  const mood = mapping.mood[pref.mood];
  const characterType = mapping.characterType[pref.characterType];
  if (purpose?.tags) purpose.tags.forEach((tag) => out.push({ tag, weight: purpose.weight }));
  if (mood?.tags) mood.tags.forEach((tag) => out.push({ tag, weight: mood.weight }));
  if (characterType?.tags) characterType.tags.forEach((tag) => out.push({ tag, weight: characterType.weight }));
  return out;
}

type BehaviorStore = {
  tags: Record<string, number>;
  updatedAt: number;
};

function readBehaviorStore(): BehaviorStore {
  if (typeof window === "undefined") return { tags: {}, updatedAt: 0 };
  try {
    const raw = localStorage.getItem(LS_BEHAVIOR);
    if (!raw) return { tags: {}, updatedAt: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed?.tags) return { tags: {}, updatedAt: 0 };
    return { tags: parsed.tags || {}, updatedAt: Number(parsed.updatedAt || 0) };
  } catch {
    return { tags: {}, updatedAt: 0 };
  }
}

function writeBehaviorStore(next: BehaviorStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_BEHAVIOR, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export type BehaviorEventType = "click" | "chat_start" | "favorite";

export function trackBehaviorEvent(args: { type: BehaviorEventType; tags: string[]; settings: RecommendationSettings }) {
  if (typeof window === "undefined") return;
  const weight = args.type === "click" ? args.settings.behaviorWeights.click : args.type === "chat_start"
    ? args.settings.behaviorWeights.chatStart
    : args.settings.behaviorWeights.favorite;
  if (!weight || !args.tags?.length) return;

  const store = readBehaviorStore();
  const next: BehaviorStore = { tags: { ...store.tags }, updatedAt: Date.now() };
  args.tags.forEach((raw) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    next.tags[tag] = Number(next.tags[tag] || 0) + Number(weight || 0);
  });
  writeBehaviorStore(next);
}

export function getBehaviorSignals(settings: RecommendationSettings, maxTags = 12) {
  const store = readBehaviorStore();
  const list = Object.entries(store.tags || [])
    .map(([tag, score]) => ({ tag, weight: Number(score || 0) }))
    .filter((x) => x.tag && x.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxTags);
  return list.map((x) => ({ tag: x.tag.startsWith("#") ? x.tag : `#${x.tag}`, weight: x.weight }));
}

export function getOrCreateAbBucket(settings: RecommendationSettings) {
  if (!settings.ab.enabled) return "A";
  if (typeof window === "undefined") return "A";
  try {
    const raw = localStorage.getItem(LS_AB);
    if (raw === "A" || raw === "B") return raw;
  } catch {
    // ignore
  }
  const bucket = Math.random() < settings.ab.ratioB ? "B" : "A";
  try {
    localStorage.setItem(LS_AB, bucket);
  } catch {
    // ignore
  }
  return bucket;
}

export function makeCacheKey(args: { bucket: "A" | "B"; safetyOn: boolean; signals: Array<{ tag: string; weight: number }> }) {
  const payload = {
    bucket: args.bucket,
    safetyOn: args.safetyOn,
    signals: args.signals.map((s) => [normalizeTag(s.tag), Number(s.weight || 0)]),
  };
  return JSON.stringify(payload);
}

export function loadRecoCache(key: string, ttlSec: number): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.key || !Array.isArray(parsed?.slugs)) return null;
    if (String(parsed.key) !== key) return null;
    const updatedAt = Number(parsed.updatedAt || 0);
    if (!updatedAt) return null;
    if (Date.now() - updatedAt > ttlSec * 1000) return null;
    return parsed.slugs as string[];
  } catch {
    return null;
  }
}

export function saveRecoCache(key: string, slugs: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_CACHE, JSON.stringify({ key, slugs, updatedAt: Date.now() }));
  } catch {
    // ignore
  }
}
