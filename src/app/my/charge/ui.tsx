"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { TopBar } from "@/components/TopBar";
import { ensurePananaIdentity } from "@/lib/pananaApp/identity";

function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <span
      className={[
        "grid h-6 w-6 place-items-center rounded-full",
        checked ? "bg-panana-pink" : "bg-white/10 ring-1 ring-white/10",
      ].join(" ")}
      aria-hidden="true"
    >
      {checked ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M20 7L10 17l-5-5"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

type ChargeProduct = {
  id: string;
  sku: string;
  title: string;
  panaAmount: number;
  bonusAmount: number;
  priceKrw: number;
  recommended?: boolean;
};

function defaultSelectedId(products: ChargeProduct[]): string | null {
  const recommended = products.find((p) => p.recommended);
  return (recommended ?? products[0])?.id ?? null;
}

export function ChargeClient({ initialProducts = [], initialBalance }: { initialProducts?: ChargeProduct[]; initialBalance?: number }) {
  const localIdt = useMemo(() => ensurePananaIdentity(), []);
  const [pananaBalance, setPananaBalance] = useState<number | null>(initialBalance ?? null);
  const [products, setProducts] = useState<ChargeProduct[]>(initialProducts);
  const [selectedId, setSelectedId] = useState<string | null>(() => defaultSelectedId(initialProducts));

  useEffect(() => {
    if (initialProducts.length > 0) return;
    let alive = true;
    fetch("/api/billing-products")
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.ok) return;
        const list = (d.products ?? []) as ChargeProduct[];
        setProducts(list);
        setSelectedId((prev) => prev || (defaultSelectedId(list) ?? null));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [initialProducts.length]);

  useEffect(() => {
    if (products.length > 0 && !selectedId) setSelectedId(defaultSelectedId(products));
  }, [products, selectedId]);

  useEffect(() => {
    if (!localIdt.id) return;
    let alive = true;
    fetch(`/api/me/balance?pananaId=${encodeURIComponent(localIdt.id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.ok) return;
        const v = typeof d.pananaBalance === "number" ? d.pananaBalance : 0;
        setPananaBalance(Math.max(0, v));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [localIdt.id]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId) ?? products[0] ?? null,
    [products, selectedId]
  );
  const selectedButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedId && products.some((p) => p.id === selectedId)) {
      selectedButtonRef.current?.focus({ preventScroll: true });
    }
  }, [selectedId, products]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title="마이 페이지" backHref="/my" />

      <main className="mx-auto w-full max-w-[420px] px-5 pb-20 pt-2">
        <div className="mt-3">
          <div className="text-[14px] font-extrabold text-white/85">나의 보관함</div>
          <div className="mt-3 rounded-2xl bg-[#2f2f3a] px-4 py-4">
            <div className="flex items-center gap-3 text-[13px] font-semibold text-white/70">
              <span className="inline-flex h-6 w-6 items-center justify-center">
                <Image src="/pana.png" alt="" width={24} height={24} className="h-6 w-6" />
              </span>
              <span>
                {(pananaBalance !== null ? pananaBalance : 0).toLocaleString("ko-KR")}
                <span className="text-[#f29ac3]">개의 파나나를 가지고 있어요</span>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-[14px] font-extrabold text-white/85">상품 정보</div>
          <div className="mt-2 text-[11px] font-semibold text-white/35">
            보관함에 담아 둔 파나나는 사라지지 않아요!
          </div>
        </div>

        {products.length === 0 ? (
          <div className="mt-4 py-8 text-center text-[13px] font-semibold text-white/45">상품 목록 불러오는 중...</div>
        ) : (
          <div className="mt-4 space-y-3">
            {products.map((p) => {
              const checked = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  ref={p.id === selectedId ? selectedButtonRef : undefined}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={[
                    "flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-4 text-left",
                    checked ? "ring-1 ring-panana-pink bg-white/[0.05]" : "bg-white/[0.04]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <Radio checked={checked} />
                    <div>
                      <div className="flex items-baseline gap-2">
                        <div className="text-[15px] font-extrabold text-white/90">
                          <div className="flex items-start gap-2">
                            <span className="mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center">
                              <Image src="/pana.png" alt="" width={24} height={24} className="h-6 w-6" />
                            </span>
                            <div className="leading-none">
                              <div>{fmt(p.panaAmount)}개</div>
                              {p.bonusAmount > 0 ? (
                                <div className="mt-1 text-[11px] font-bold text-panana-pink">
                                  + {fmt(p.bonusAmount)}개
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[13px] font-extrabold text-[#ffa9d6]">{fmt(p.priceKrw)}원</div>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="mt-6 w-full rounded-2xl bg-panana-pink px-5 py-4 text-[15px] font-extrabold text-white"
          disabled={!selectedProduct}
        >
          충전하기
        </button>

        <div className="mt-8 text-[11px] leading-[1.7] text-white/35">
          <div className="font-bold text-white/45">할부정책 및 파나나 포인트 이용 안내</div>
          <div className="mt-2">
            파나나는 결제 방법(전자상거래법 등)을 준수하며, 투명한 결제 절차를 보장합니다.
          </div>
          <div className="mt-3 space-y-2">
            <div>
              1. 결제 후 포인트는 즉시 지급되며, 사용하지 않은 경우에 한해 결제 취소가 가능합니다.
            </div>
            <div>
              2. 이벤트/출석/보상 등으로 지급된 보너스 포인트는 일부 제한이 있을 수 있습니다.
            </div>
            <div>3. 운영정책 위반으로 계정이 정지된 경우 환불이 제한될 수 있습니다.</div>
          </div>
          <div className="mt-4 font-semibold text-white/50">
            충전내역 확인하기 / 할부정책 전체보기
          </div>
        </div>
      </main>
    </div>
  );
}
