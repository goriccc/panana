"use client";

import { AdminButton, AdminInput, AdminSectionHeader, AdminTable, useAdminCrudList } from "../_components/AdminUI";
import { useMemo, useState } from "react";

type CategoryRow = {
  id: string;
  slug: string;
  title: string;
  order: number;
  active: boolean;
};

const seed: CategoryRow[] = [
  { id: "cat-1", slug: "for-me", title: "나에게 맞는", order: 1, active: true },
  { id: "cat-2", slug: "new", title: "새로 올라온", order: 2, active: true },
  { id: "cat-3", slug: "loved", title: "모두에게 사랑받는", order: 3, active: true },
];

export default function AdminCategoriesPage() {
  const crud = useAdminCrudList<CategoryRow>(seed);
  const [slug, setSlug] = useState(crud.selected?.slug || "");
  const [title, setTitle] = useState(crud.selected?.title || "");
  const [order, setOrder] = useState(String(crud.selected?.order ?? 1));

  const syncFromSelected = () => {
    setSlug(crud.selected?.slug || "");
    setTitle(crud.selected?.title || "");
    setOrder(String(crud.selected?.order ?? 1));
  };

  useMemo(() => {
    syncFromSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crud.selectedId]);

  const rows = crud.items.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    order: c.order,
    active: c.active,
  }));

  return (
    <div>
      <AdminSectionHeader
        title="카테고리"
        subtitle="홈 카테고리 섹션의 제목/정렬/노출 여부를 관리합니다. (각 카테고리당 최대 4개 카드 노출 규칙은 프론트에서 유지)"
        right={
          <>
            <AdminButton
              variant="ghost"
              onClick={() => {
                const id = `cat-${Date.now()}`;
                crud.setItems((prev) => [
                  ...prev,
                  { id, slug: `new-${prev.length + 1}`, title: "새 카테고리", order: prev.length + 1, active: true },
                ]);
                crud.setSelectedId(id);
              }}
            >
              + 새 카테고리
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

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <AdminTable
          columns={[
            { key: "title", header: "제목" },
            { key: "slug", header: "슬러그" },
            { key: "order", header: "정렬" },
            { key: "active", header: "노출" },
            { key: "actions", header: "선택" },
          ]}
          rows={rows.map((r) => ({
            title: r.title,
            slug: <span className="text-white/55">{r.slug}</span>,
            order: r.order,
            active: r.active ? (
              <span className="rounded-full bg-[#22c55e]/15 px-2 py-1 text-[11px] font-extrabold text-[#6ee7b7]">
                ON
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/45">OFF</span>
            ),
            actions: (
              <AdminButton variant="ghost" onClick={() => crud.setSelectedId(r.id)}>
                편집
              </AdminButton>
            ),
          }))}
        />

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[13px] font-extrabold text-white/80">편집</div>
          <div className="mt-4 space-y-4">
            <AdminInput label="슬러그" value={slug} onChange={setSlug} placeholder="예: for-me" />
            <AdminInput label="제목" value={title} onChange={setTitle} placeholder="예: 나에게 맞는" />
            <AdminInput label="정렬" value={order} onChange={setOrder} placeholder="숫자" />
            <div className="flex gap-2">
              <AdminButton
                onClick={() => {
                  if (!crud.selected) return;
                  const nextOrder = Number(order) || 1;
                  crud.setItems((prev) =>
                    prev.map((x) =>
                      x.id === crud.selected!.id ? { ...x, slug: slug.trim(), title: title.trim(), order: nextOrder } : x
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
            </div>
            <div className="text-[11px] font-semibold leading-[1.5] text-white/35">
              Supabase 연동 시: `categories` 테이블을 업데이트하고, 프론트는 `active=true`이면서 `order` 기준으로 정렬해 렌더링하면 됩니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

