"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminInput, AdminSectionHeader, useAdminCrudList } from "../_components/AdminUI";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type ProductRow = {
  id: string;
  sku: string;
  title: string;
  panaAmount: number;
  bonusAmount: number;
  priceKrw: number;
  recommended: boolean;
  sortOrder: number;
  active: boolean;
};

async function getAdminAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await getBrowserSupabase().auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("로그인이 필요해요.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function AdminBillingPage() {
  const crud = useAdminCrudList<ProductRow>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sku, setSku] = useState("");
  const [title, setTitle] = useState("");
  const [panaAmount, setPanaAmount] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [priceKrw, setPriceKrw] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/billing-products", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "목록을 불러올 수 없어요.");
      }
      const list = (data.products ?? []) as ProductRow[];
      crud.setItems(list);
      if (!crud.selectedId && list[0]?.id) crud.setSelectedId(list[0].id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const s = crud.selected;
    setSku(s?.sku ?? "");
    setTitle(s?.title ?? "");
    setPanaAmount(String(s?.panaAmount ?? 0));
    setBonusAmount(String(s?.bonusAmount ?? 0));
    setPriceKrw(String(s?.priceKrw ?? 0));
  }, [crud.selectedId, crud.selected]);

  const moveProduct = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const fromIdx = crud.items.findIndex((x) => x.id === fromId);
      const toIdx = crud.items.findIndex((x) => x.id === toId);
      if (fromIdx < 0 || toIdx < 0) return;
      const next = [...crud.items];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const withOrder = next.map((x, idx) => ({ ...x, sortOrder: idx }));
      crud.setItems(withOrder);
      return withOrder;
    },
    [crud.items, crud.setItems]
  );

  const persistOrder = useCallback(
    async (orderedItems: ProductRow[]) => {
      const orderIds = orderedItems.map((p) => p.id);
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/billing-products", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ reorder: orderIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "순서 저장 실패");
      if (Array.isArray(data.products)) crud.setItems(data.products);
    },
    [crud.setItems]
  );

  const saveCurrent = async () => {
    if (!crud.selected) return;
    setSaving(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/billing-products", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          id: crud.selected.id,
          sku: sku.trim(),
          title: title.trim(),
          panaAmount: Number(panaAmount) || 0,
          bonusAmount: Number(bonusAmount) || 0,
          priceKrw: Number(priceKrw) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "저장 실패");
      crud.setItems((prev) =>
        prev.map((x) => (x.id === crud.selected!.id ? { ...x, ...data.product } : x))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const addProduct = async () => {
    setSaving(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/billing-products", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sku: `PANA_${Date.now()}`,
          title: "파나나 충전",
          panaAmount: 0,
          bonusAmount: 0,
          priceKrw: 0,
          active: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "추가 실패");
      const newRow = data.product as ProductRow;
      crud.setItems((prev) => [...prev, newRow]);
      crud.setSelectedId(newRow.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "추가 실패");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!crud.selected) return;
    setSaving(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch("/api/admin/billing-products", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: crud.selected.id, active: !crud.selected.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "토글 실패");
      crud.setItems((prev) =>
        prev.map((x) => (x.id === crud.selected!.id ? { ...x, active: data.product.active } : x))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "토글 실패");
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrent = async () => {
    if (!crud.selected) return;
    if (!confirm(`"${crud.selected.title || crud.selected.sku}" 상품을 삭제할까요?`)) return;
    setSaving(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/admin/billing-products?id=${encodeURIComponent(crud.selected.id)}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "삭제 실패");
      const deletedId = crud.selected.id;
      const remaining = crud.items.filter((x) => x.id !== deletedId);
      crud.setItems(remaining);
      crud.setSelectedId(remaining[0]?.id ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="충전 상품 (my/charge)"
          subtitle="레이블, 충전 파나나, 보너스 파나나, 충전금액을 DB(panana_billing_products)에서 관리합니다. 앱 /my/charge는 active=true 상품만 노출합니다."
          right={
            <>
              <AdminButton variant="ghost" onClick={() => loadProducts()}>
                새로고침
              </AdminButton>
              <AdminButton variant="ghost" onClick={addProduct} disabled={saving}>
                + 새 상품
              </AdminButton>
            </>
          }
        />

        {error ? <div className="mb-3 text-[12px] font-semibold text-[#ff9aa1]">{error}</div> : null}
        {loading ? <div className="mb-3 text-[12px] font-semibold text-white/45">불러오는 중...</div> : null}

        <div className="mb-6 rounded-2xl border border-white/10 bg-black/10 p-4">
          <div className="text-[13px] font-extrabold text-white/80">상품 목록 (드래그로 순서 변경)</div>
          <div className="mt-3 space-y-2">
            {crud.items.map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => {
                  setDragId(p.id);
                  try {
                    e.dataTransfer.setData("text/plain", p.id);
                  } catch {}
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from =
                    (() => {
                      try {
                        return e.dataTransfer.getData("text/plain");
                      } catch {
                        return "";
                      }
                    })() || dragId;
                  if (!from) return;
                  const next = moveProduct(from, p.id);
                  setDragId(null);
                  if (next?.length) {
                    setSaving(true);
                    setError(null);
                    persistOrder(next).catch((err) => setError(err instanceof Error ? err.message : "순서 저장 실패")).finally(() => setSaving(false));
                  }
                }}
                onDragEnd={() => setDragId(null)}
                className={`flex cursor-grab items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 active:cursor-grabbing ${
                  p.id === crud.selectedId ? "ring-2 ring-[#ff4da7]/40" : ""
                } ${dragId === p.id ? "opacity-60" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => crud.setSelectedId(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    crud.setSelectedId(p.id);
                  }
                }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[14px] font-extrabold text-white/50">
                  ≡
                </div>
                <span className="min-w-[120px] text-[13px] font-semibold text-white/70">{p.sku}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/80">{p.title || "(제목 없음)"}</span>
                {p.recommended ? (
                  <span className="rounded-full bg-[#ff4da7]/20 px-2 py-1 text-[11px] font-extrabold text-[#ffa9d6]">추천</span>
                ) : null}
                <span className="text-[13px] font-semibold text-white/70">
                  {p.panaAmount.toLocaleString()} + {p.bonusAmount.toLocaleString()}
                </span>
                <span className="text-[13px] font-semibold text-white/70">{p.priceKrw.toLocaleString()}원</span>
                <div className="flex items-center gap-2">
                  {p.active ? (
                    <span className="rounded-full bg-[#22c55e]/15 px-2 py-1 text-[11px] font-extrabold text-[#6ee7b7]">ON</span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/45">OFF</span>
                  )}
                </div>
                <span onClick={(e) => e.stopPropagation()}>
                  <AdminButton variant="ghost" onClick={() => crud.setSelectedId(p.id)}>
                    편집
                  </AdminButton>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-[13px] font-extrabold text-white/80">편집</div>
            <div className="mt-4 space-y-4">
              <AdminInput label="레이블" value={title} onChange={setTitle} placeholder="예: 파나나 충전" />
              <AdminInput label="결제코드 SKU" value={sku} onChange={setSku} placeholder="예: PANA_2000" />
              <AdminInput label="충전 파나나" value={panaAmount} onChange={setPanaAmount} placeholder="숫자" />
              <AdminInput label="보너스 파나나" value={bonusAmount} onChange={setBonusAmount} placeholder="숫자" />
              <AdminInput label="충전금액 (KRW)" value={priceKrw} onChange={setPriceKrw} placeholder="숫자" />
              <div className="flex flex-wrap gap-2">
                <AdminButton onClick={saveCurrent} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </AdminButton>
                <AdminButton variant="ghost" onClick={toggleActive} disabled={saving}>
                  노출 토글
                </AdminButton>
                <AdminButton variant="danger" onClick={deleteCurrent} disabled={saving || !crud.selected}>
                  삭제
                </AdminButton>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-[13px] font-extrabold text-white/80">추천 상품</div>
            <div className="mt-2 text-[12px] font-semibold text-white/45">1개만 선택, /my/charge 기본 선택</div>
            <div className="mt-3 space-y-2">
              {crud.items.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04]"
                >
                  <input
                    type="radio"
                    name="recommended"
                    checked={p.recommended}
                    onChange={async () => {
                      if (p.recommended) return;
                      setSaving(true);
                      setError(null);
                      try {
                        const headers = await getAdminAuthHeaders();
                        const res = await fetch("/api/admin/billing-products", {
                          method: "PATCH",
                          headers,
                          body: JSON.stringify({ setRecommended: p.id }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || !data?.ok) throw new Error(data?.error || "저장 실패");
                        crud.setItems((prev) => prev.map((x) => ({ ...x, recommended: x.id === p.id })));
                      } catch (e: unknown) {
                        setError(e instanceof Error ? e.message : "저장 실패");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="h-4 w-4 accent-panana-pink"
                  />
                  <span className="text-[13px] font-semibold text-white/80">
                    {p.title || p.sku} ({p.panaAmount.toLocaleString()} P)
                  </span>
                  {p.recommended ? (
                    <span className="rounded-full bg-[#ff4da7]/20 px-2 py-0.5 text-[10px] font-bold text-[#ffa9d6]">추천</span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}
