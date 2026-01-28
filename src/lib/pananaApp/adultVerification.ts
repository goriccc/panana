import { ensurePananaIdentity } from "@/lib/pananaApp/identity";

export type AdultStatus = {
  adultVerified: boolean;
  adultVerifiedAt: string | null;
  birth: string | null;
};

export function calcAgeFromBirth(birth: string | null) {
  if (!birth || birth.length !== 8) return null;
  const y = Number(birth.slice(0, 4));
  const m = Number(birth.slice(4, 6));
  const d = Number(birth.slice(6, 8));
  if (!y || !m || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const mm = now.getMonth() + 1;
  const dd = now.getDate();
  if (mm < m || (mm === m && dd < d)) age -= 1;
  return age;
}

export async function fetchAdultStatus(): Promise<AdultStatus | null> {
  try {
    const idt = ensurePananaIdentity();
    const pananaId = String(idt.id || "").trim();
    const qs = pananaId ? `?pananaId=${encodeURIComponent(pananaId)}` : "";
    const res = await fetch(`/api/me/adult-verify${qs}`, { method: "GET" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;
    return {
      adultVerified: Boolean(data.adultVerified),
      adultVerifiedAt: data.adultVerifiedAt ? String(data.adultVerifiedAt) : null,
      birth: data.birth ? String(data.birth) : null,
    };
  } catch {
    return null;
  }
}

export async function verifyAdult(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const idt = ensurePananaIdentity();
    const pananaId = String(idt.id || "").trim();
    const res = await fetch("/api/me/adult-verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pananaId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return { ok: false, error: String(data?.error || "인증에 실패했어요.") };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "인증에 실패했어요." };
  }
}
