import { ensurePananaIdentity } from "@/lib/pananaApp/identity";

export type Gender = "female" | "male" | "both" | "private";

export type AccountInfo = {
  birth: string | null; // YYYYMMDD
  gender: Gender | null;
};

export async function fetchMyAccountInfo(): Promise<AccountInfo | null> {
  try {
    const idt = ensurePananaIdentity();
    const pananaId = String(idt.id || "").trim();
    const qs = pananaId ? `?pananaId=${encodeURIComponent(pananaId)}` : "";
    const res = await fetch(`/api/me/account-info${qs}`, { method: "GET" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;
    const birth = data.birth ? String(data.birth) : null;
    const gender = data.gender ? (String(data.gender) as Gender) : null;
    return { birth, gender };
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
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "저장에 실패했어요." };
  }
}

