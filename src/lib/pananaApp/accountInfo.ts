import { ensurePananaIdentity } from "@/lib/pananaApp/identity";

export type Gender = "female" | "male" | "both" | "private";

export type AccountInfo = {
  birth: string | null; // YYYYMMDD
  gender: Gender | null;
};

const CACHE_TTL_MS = 30_000; // 30초
type CacheEntry = { data: AccountInfo; at: number };

let memoryCache: { key: string; entry: CacheEntry } | null = null;

function cacheKey(pananaId: string): string {
  return pananaId || "session";
}

function getCached(key: string): AccountInfo | null {
  if (!memoryCache || memoryCache.key !== key) return null;
  const { entry } = memoryCache;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    memoryCache = null;
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: AccountInfo): void {
  memoryCache = { key, entry: { data, at: Date.now() } };
}

export function invalidateAccountInfoCache(): void {
  memoryCache = null;
}

/** 계정설정/내정보 수정 진입 전 호출 시 캐시를 미리 채워 둠 (hover 등) */
export function prefetchMyAccountInfo(): void {
  fetchMyAccountInfo().then(() => {});
}

export async function fetchMyAccountInfo(): Promise<AccountInfo | null> {
  try {
    const idt = ensurePananaIdentity();
    const pananaId = String(idt.id || "").trim();
    const key = cacheKey(pananaId);
    let resetAt: string | null = null;
    if (typeof window !== "undefined") {
      try {
        resetAt = localStorage.getItem("panana_account_info_reset_at");
      } catch {}
    }
    const resetAtNum = resetAt ? Number(resetAt) : NaN;
    const shouldBypassCache =
      Number.isFinite(resetAtNum) && resetAtNum > 0 && Date.now() - resetAtNum < 2 * 60 * 1000;
    const cached = shouldBypassCache ? null : getCached(key);
    if (cached) return cached;

    const qs = pananaId ? `?pananaId=${encodeURIComponent(pananaId)}` : "";
    const bust = shouldBypassCache ? `${qs ? "&" : "?"}ts=${resetAt}` : "";
    const res = await fetch(`/api/me/account-info${qs}${bust}`, {
      method: "GET",
      cache: shouldBypassCache ? "no-store" : "default",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;
    const birth = data.birth ? String(data.birth) : null;
    const gender = data.gender ? (String(data.gender) as Gender) : null;
    const info: AccountInfo = { birth, gender };
    setCached(key, info);
    if (shouldBypassCache && typeof window !== "undefined") {
      try {
        localStorage.removeItem("panana_account_info_reset_at");
      } catch {}
    }
    return info;
  } catch {
    return null;
  }
}

export async function updateMyAccountInfo(patch: Partial<AccountInfo>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const idt = ensurePananaIdentity();
    const pananaId = String(idt.id || "").trim();
    const res = await fetch("/api/me/account-info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pananaId,
        birth: patch.birth ?? undefined,
        gender: patch.gender ?? undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return { ok: false, error: String(data?.error || "저장에 실패했어요.") };
    invalidateAccountInfoCache();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "저장에 실패했어요." };
  }
}

