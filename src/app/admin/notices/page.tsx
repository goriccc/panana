"use client";

import { useMemo, useState } from "react";
import { AdminButton, AdminInput, AdminSectionHeader, AdminTable, AdminTextarea, useAdminCrudList } from "../_components/AdminUI";

type NoticeRow = {
  id: string;
  title: string;
  summary: string;
  body: string;
  published: boolean;
  createdAt: string;
};

const seed: NoticeRow[] = [
  {
    id: "n-1",
    title: "서비스 오픈 안내",
    summary: "Panana가 오픈했어요.",
    body: "서비스 오픈 안내 본문(더미)",
    published: true,
    createdAt: "2026-01-21",
  },
  {
    id: "n-2",
    title: "이벤트 안내",
    summary: "멤버십 혜택을 확인하세요.",
    body: "이벤트 안내 본문(더미)",
    published: false,
    createdAt: "2026-01-20",
  },
];

export default function AdminNoticesPage() {
  const crud = useAdminCrudList<NoticeRow>(seed);
  const [title, setTitle] = useState(crud.selected?.title || "");
  const [summary, setSummary] = useState(crud.selected?.summary || "");
  const [body, setBody] = useState(crud.selected?.body || "");

  useMemo(() => {
    setTitle(crud.selected?.title || "");
    setSummary(crud.selected?.summary || "");
    setBody(crud.selected?.body || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crud.selectedId]);

  return (
    <div>
      <AdminSectionHeader
        title="공지사항"
        subtitle="마이페이지 공지사항 리스트/상세에 노출되는 콘텐츠를 관리합니다. 게시 여부/정렬/작성일을 포함합니다."
        right={
          <>
            <AdminButton
              variant="ghost"
              onClick={() => {
                const id = `n-${Date.now()}`;
                crud.setItems((prev) => [
                  ...prev,
                  {
                    id,
                    title: "새 공지",
                    summary: "",
                    body: "",
                    published: false,
                    createdAt: new Date().toISOString().slice(0, 10),
                  },
                ]);
                crud.setSelectedId(id);
              }}
            >
              + 새 공지
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
            { key: "title", header: "제목" },
            { key: "date", header: "작성일" },
            { key: "pub", header: "게시" },
            { key: "actions", header: "선택" },
          ]}
          rows={crud.items.map((n) => ({
            title: n.title,
            date: <span className="text-white/55">{n.createdAt}</span>,
            pub: n.published ? (
              <span className="rounded-full bg-[#22c55e]/15 px-2 py-1 text-[11px] font-extrabold text-[#6ee7b7]">
                게시중
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/45">비공개</span>
            ),
            actions: (
              <AdminButton variant="ghost" onClick={() => crud.setSelectedId(n.id)}>
                편집
              </AdminButton>
            ),
          }))}
        />

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[13px] font-extrabold text-white/80">편집</div>
          <div className="mt-4 space-y-4">
            <AdminInput label="제목" value={title} onChange={setTitle} placeholder="공지 제목" />
            <AdminInput label="요약" value={summary} onChange={setSummary} placeholder="리스트에 보이는 한 줄" />
            <AdminTextarea label="본문" value={body} onChange={setBody} placeholder="상세 본문" rows={10} />

            <div className="flex gap-2">
              <AdminButton
                onClick={() => {
                  if (!crud.selected) return;
                  crud.setItems((prev) =>
                    prev.map((x) =>
                      x.id === crud.selected!.id ? { ...x, title: title.trim(), summary: summary.trim(), body } : x
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
                  crud.setItems((prev) => prev.map((x) => (x.id === crud.selected!.id ? { ...x, published: !x.published } : x)));
                }}
              >
                게시 토글
              </AdminButton>
            </div>

            <div className="text-[11px] font-semibold leading-[1.5] text-white/35">
              Supabase 연동 시: `notices` 테이블에 `published_at`(nullable)로 공개/비공개를 표현하면 스케줄 게시도 쉽게 처리됩니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

