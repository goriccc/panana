/**
 * /api/me/identity 호출을 전역 스로틀하여 짧은 시간에 반복 호출 방지
 */

const THROTTLE_MS = 15_000;
let lastFetchTime = 0;
let lastFetchPromise: Promise<{ id: string; handle: string; nickname: string } | null> | null = null;

export type IdentityApiResult = { id: string; handle: string; nickname: string } | null;

export async function fetchIdentityThrottled(pananaId: string): Promise<IdentityApiResult> {
  if (typeof window === "undefined") return null;
  const now = Date.now();
  if (now - lastFetchTime < THROTTLE_MS && lastFetchPromise !== null) {
    return lastFetchPromise;
  }
  lastFetchTime = now;
  lastFetchPromise = (async () => {
    try {
      const res = await fetch("/api/me/identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pananaId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.id) return null;
      return {
        id: String(data.id || "").trim(),
        handle: String(data.handle || "").trim().toLowerCase(),
        nickname: String(data.nickname || "").trim(),
      };
    } catch {
      return null;
    } finally {
      if (Date.now() - lastFetchTime >= THROTTLE_MS) {
        lastFetchPromise = null;
      }
    }
  })();
  return lastFetchPromise;
}

/** 스로틀 초기화 (테스트 또는 로그아웃 시 호출 가능) */
export function resetIdentityThrottle(): void {
  lastFetchTime = 0;
  lastFetchPromise = null;
}
