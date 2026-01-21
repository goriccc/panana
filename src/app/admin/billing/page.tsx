"use client";

import { useMemo, useState } from "react";
import { AdminButton, AdminInput, AdminSectionHeader, AdminTable, useAdminCrudList } from "../_components/AdminUI";

type ProductRow = {
  id: string;
  sku: string;
  title: string;
  panaAmount: number;
  bonusAmount: number;
  priceKrw: number;
  recommended: boolean;
  active: boolean;
};

const seed: ProductRow[] = [
  { id: "p-1", sku: "PANA_28000", title: "파나나 충전", panaAmount: 28000, bonusAmount: 2000, priceKrw: 9900, recommended: true, active: true },
  { id: "p-2", sku: "PANA_9000", title: "파나나 충전", panaAmount: 9000, bonusAmount: 500, priceKrw: 3900, recommended: false, active: true },
];

export default function AdminBillingPage() {
  const crud = useAdminCrudList<ProductRow>(seed);
  const [sku, setSku] = useState(crud.selected?.sku || "");
  const [title, setTitle] = useState(crud.selected?.title || "");
  const [panaAmount, setPanaAmount] = useState(String(crud.selected?.panaAmount ?? 0));
  const [bonusAmount, setBonusAmount] = useState(String(crud.selected?.bonusAmount ?? 0));
  const [priceKrw, setPriceKrw] = useState(String(crud.selected?.priceKrw ?? 0));

  useMemo(() => {
    setSku(crud.selected?.sku || "");
    setTitle(crud.selected?.title || "");
    setPanaAmount(String(crud.selected?.panaAmount ?? 0));
    setBonusAmount(String(crud.selected?.bonusAmount ?? 0));
    setPriceKrw(String(crud.selected?.priceKrw ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crud.selectedId]);

  return (
    <div>
      <AdminSectionHeader
        title="충전 상품"
        subtitle="마이페이지 > 충전 화면의 상품 구성(수량/보너스/가격/추천)을 관리합니다."
        right={
          <>
            <AdminButton
              variant="ghost"
              onClick={() => {
                const id = `p-${Date.now()}`;
                crud.setItems((prev) => [
                  ...prev,
                  {
                    id,
                    sku: `PANA_${(prev.length + 1) * 1000}`,
                    title: "파나나 충전",
                    panaAmount: 0,
                    bonusAmount: 0,
                    priceKrw: 0,
                    recommended: false,
                    active: true,
                  },
                ]);
                crud.setSelectedId(id);
              }}
            >
              + 새 상품
            </AdminButton>
            <AdminButton
              variant="danger"
              onClick={() => {
                if (!crud.selectedId) return;
                crud.setItems((prev) => prev.filter((x) => x.id !== crud.selectedId));
                crud.setSelectedId(null);
              }}
            >
              삭제
            </AdminButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <AdminTable
          columns={[
            { key: "sku", header: "SKU" },
            { key: "amount", header: "수량" },
            { key: "price", header: "가격" },
            { key: "flags", header: "상태" },
            { key: "actions", header: "선택" },
          ]}
          rows={crud.items.map((p) => ({
            sku: <span className="text-white/70">{p.sku}</span>,
            amount: (
              <span className="text-white/80">
                {p.panaAmount.toLocaleString()} + {p.bonusAmount.toLocaleString()}
              </span>
            ),
            price: <span className="text-white/80">{p.priceKrw.toLocaleString()}원</span>,
            flags: (
              <div className="flex items-center gap-2">
                {p.recommended ? (
                  <span className="rounded-full bg-[#ff4da7]/20 px-2 py-1 text-[11px] font-extrabold text-[#ffa9d6]">
                    추천
                  </span>
                ) : null}
                {p.active ? (
                  <span className="rounded-full bg-[#22c55e]/15 px-2 py-1 text-[11px] font-extrabold text-[#6ee7b7]">
                    ON
                  </span>
                ) : (
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/45">OFF</span>
                )}
              </div>
            ),
            actions: (
              <AdminButton variant="ghost" onClick={() => crud.setSelectedId(p.id)}>
                편집
              </AdminButton>
            ),
          }))}
        />

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[13px] font-extrabold text-white/80">편집</div>
          <div className="mt-4 space-y-4">
            <AdminInput label="SKU" value={sku} onChange={setSku} placeholder="예: PANA_28000" />
            <AdminInput label="표시 타이틀" value={title} onChange={setTitle} placeholder="예: 파나나 충전" />
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInput label="파나나 수량" value={panaAmount} onChange={setPanaAmount} placeholder="숫자" />
              <AdminInput label="보너스 수량" value={bonusAmount} onChange={setBonusAmount} placeholder="숫자" />
            </div>
            <AdminInput label="가격(KRW)" value={priceKrw} onChange={setPriceKrw} placeholder="숫자" />

            <div className="flex flex-wrap gap-2">
              <AdminButton
                onClick={() => {
                  if (!crud.selected) return;
                  crud.setItems((prev) =>
                    prev.map((x) =>
                      x.id === crud.selected!.id
                        ? {
                            ...x,
                            sku: sku.trim(),
                            title: title.trim(),
                            panaAmount: Number(panaAmount) || 0,
                            bonusAmount: Number(bonusAmount) || 0,
                            priceKrw: Number(priceKrw) || 0,
                          }
                        : x
                    )
                  );
                }}
              >
                저장
              </AdminButton>
              <AdminButton
                variant="ghost"
                onClick={() => {
                  if (!crud.selected) return;
                  crud.setItems((prev) => prev.map((x) => (x.id === crud.selected!.id ? { ...x, active: !x.active } : x)));
                }}
              >
                노출 토글
              </AdminButton>
              <AdminButton
                variant="ghost"
                onClick={() => {
                  if (!crud.selected) return;
                  crud.setItems((prev) =>
                    prev.map((x) => (x.id === crud.selected!.id ? { ...x, recommended: !x.recommended } : x))
                  );
                }}
              >
                추천 토글
              </AdminButton>
            </div>

            <div className="text-[11px] font-semibold leading-[1.5] text-white/35">
              Supabase 연동 시: 결제는 `products`(정의) / `orders`(구매) / `ledger`(증감)로 분리하고, 프론트 충전 화면은 `active=true`인 상품만 노출하면 됩니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

