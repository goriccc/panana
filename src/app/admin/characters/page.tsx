"use client";

import { useMemo, useState } from "react";
import { AdminButton, AdminInput, AdminSectionHeader, AdminTable, AdminTextarea, useAdminCrudList } from "../_components/AdminUI";
import { adminCategoryOptions } from "@/lib/admin/categoryOptions";

type CharacterRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  profileImageUrl: string;
  postsCount: number;
  active: boolean;
  categorySlugs: string[]; // 홈 카테고리 노출 연결
};

const seed: CharacterRow[] = [
  {
    id: "ch-1",
    slug: "kim-seol-a",
    name: "김설아",
    tagline: "따뜻하지만 시크한 너의 친구",
    profileImageUrl: "/pana.png",
    postsCount: 10,
    active: true,
    categorySlugs: ["for-me", "new"],
  },
  {
    id: "ch-2",
    slug: "family-look-gyemnam",
    name: "가족자것입은게겐남",
    tagline: "도전모드, 같이 할래?",
    profileImageUrl: "/pana.png",
    postsCount: 8,
    active: true,
    categorySlugs: ["loved"],
  },
];

export default function AdminCharactersPage() {
  const crud = useAdminCrudList<CharacterRow>(seed);
  const [slug, setSlug] = useState(crud.selected?.slug || "");
  const [name, setName] = useState(crud.selected?.name || "");
  const [tagline, setTagline] = useState(crud.selected?.tagline || "");
  const [profileImageUrl, setProfileImageUrl] = useState(crud.selected?.profileImageUrl || "");
  const [postsCount, setPostsCount] = useState(String(crud.selected?.postsCount ?? 0));
  const [categorySlugs, setCategorySlugs] = useState<string[]>(crud.selected?.categorySlugs || []);
  const [notes, setNotes] = useState("");

  useMemo(() => {
    setSlug(crud.selected?.slug || "");
    setName(crud.selected?.name || "");
    setTagline(crud.selected?.tagline || "");
    setProfileImageUrl(crud.selected?.profileImageUrl || "");
    setPostsCount(String(crud.selected?.postsCount ?? 0));
    setCategorySlugs(crud.selected?.categorySlugs || []);
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crud.selectedId]);

  return (
    <div>
      <AdminSectionHeader
        title="캐릭터"
        subtitle="프로필(인스타 스타일), 게시물(이미지 목록), 추천 섹션, 채팅 진입 연결에 필요한 데이터를 관리합니다."
        right={
          <>
            <AdminButton
              variant="ghost"
              onClick={() => {
                const id = `ch-${Date.now()}`;
                crud.setItems((prev) => [
                  ...prev,
                  {
                    id,
                    slug: `new-character-${prev.length + 1}`,
                    name: "새 캐릭터",
                    tagline: "",
                    profileImageUrl: "/pana.png",
                    postsCount: 0,
                    active: true,
                    categorySlugs: [],
                  },
                ]);
                crud.setSelectedId(id);
              }}
            >
              + 새 캐릭터
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
            { key: "name", header: "이름" },
            { key: "slug", header: "슬러그" },
            { key: "categories", header: "카테고리" },
            { key: "posts", header: "게시물" },
            { key: "active", header: "노출" },
            { key: "actions", header: "선택" },
          ]}
          rows={crud.items.map((c) => ({
            name: c.name,
            slug: <span className="text-white/55">{c.slug}</span>,
            categories: (
              <div className="flex flex-wrap gap-2">
                {c.categorySlugs.length ? (
                  c.categorySlugs.map((s) => {
                    const cat = adminCategoryOptions.find((x) => x.slug === s);
                    return (
                      <span
                        key={s}
                        className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/70"
                      >
                        {cat?.title || s}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[12px] font-semibold text-white/35">미설정</span>
                )}
              </div>
            ),
            posts: (
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/70">
                {c.postsCount}개
              </span>
            ),
            active: c.active ? (
              <span className="rounded-full bg-[#22c55e]/15 px-2 py-1 text-[11px] font-extrabold text-[#6ee7b7]">
                ON
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/45">OFF</span>
            ),
            actions: (
              <AdminButton variant="ghost" onClick={() => crud.setSelectedId(c.id)}>
                편집
              </AdminButton>
            ),
          }))}
        />

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[13px] font-extrabold text-white/80">편집</div>
          <div className="mt-4 space-y-4">
            <AdminInput label="슬러그" value={slug} onChange={setSlug} placeholder="예: kim-seol-a" />
            <AdminInput label="이름" value={name} onChange={setName} placeholder="예: 김설아" />
            <AdminInput label="한 줄 소개" value={tagline} onChange={setTagline} placeholder="예: 따뜻하지만 시크한 너의 친구" />
            <AdminInput label="프로필 이미지 URL" value={profileImageUrl} onChange={setProfileImageUrl} placeholder="/..." />
            <AdminInput label="게시물 개수(더미)" value={postsCount} onChange={setPostsCount} placeholder="숫자" />

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-[12px] font-extrabold text-white/70">카테고리 연결(홈 노출)</div>
              <div className="mt-3 space-y-2">
                {adminCategoryOptions.map((cat) => {
                  const checked = categorySlugs.includes(cat.slug);
                  return (
                    <label
                      key={cat.slug}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 py-3"
                    >
                      <div className="text-[12px] font-semibold text-white/70">{cat.title}</div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setCategorySlugs((prev) => (on ? Array.from(new Set([...prev, cat.slug])) : prev.filter((x) => x !== cat.slug)));
                        }}
                        className="h-4 w-4 accent-[#ff4da7]"
                      />
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 text-[11px] font-semibold text-white/35">
                Supabase 연동 시: `character_categories(character_id, category_slug)` 또는 `category_id` FK 매핑 테이블로 관리 권장.
              </div>
            </div>

            <AdminTextarea
              label="메모(어드민 내부용)"
              value={notes}
              onChange={setNotes}
              placeholder="추천 섹션 문구, 운영 메모 등"
              rows={5}
            />

            <div className="flex gap-2">
              <AdminButton
                onClick={() => {
                  if (!crud.selected) return;
                  const nextPosts = Number(postsCount) || 0;
                  crud.setItems((prev) =>
                    prev.map((x) =>
                      x.id === crud.selected!.id
                        ? {
                            ...x,
                            slug: slug.trim(),
                            name: name.trim(),
                            tagline: tagline.trim(),
                            profileImageUrl: profileImageUrl.trim(),
                            postsCount: nextPosts,
                            categorySlugs,
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
            </div>

            <div className="text-[11px] font-semibold leading-[1.5] text-white/35">
              Supabase 연동 시: `characters`, `character_posts`, `character_recommendations`(섹션/태그/카드) 등을 분리해서 관리하는
              구성이 가장 깔끔합니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

