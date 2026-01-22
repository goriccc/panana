"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminInput, AdminSectionHeader, AdminTable, AdminTextarea, useAdminCrudList } from "../_components/AdminUI";
import Image from "next/image";
import {
  createMembershipBanner,
  deleteMembershipBanner,
  listMembershipBanners,
  reorderMembershipBanners,
  type MembershipBannerRow,
  updateMembershipBanner,
  uploadMembershipBannerImage,
} from "@/lib/pananaAdmin/membershipBanners";

export default function AdminMembershipPage() {
  const banners = useAdminCrudList<MembershipBannerRow>([]);
  const [loadingBanners, setLoadingBanners] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const [bTitle, setBTitle] = useState("");
  const [bLinkUrl, setBLinkUrl] = useState("");
  const [bSortOrder, setBSortOrder] = useState("0");
  const [bActive, setBActive] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const reloadBanners = async () => {
    setLoadingBanners(true);
    setBannerError(null);
    try {
      const rows = await listMembershipBanners();
      banners.setItems(rows);
      if (!banners.selectedId && rows[0]?.id) banners.setSelectedId(rows[0].id);
    } catch (e: any) {
      setBannerError(e?.message || "배너를 불러오지 못했어요.");
    } finally {
      setLoadingBanners(false);
    }
  };

  useEffect(() => {
    reloadBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMemo(() => {
    setBTitle(banners.selected?.title || "");
    setBLinkUrl(banners.selected?.link_url || "");
    setBSortOrder(String(banners.selected?.sort_order ?? 0));
    setBActive(Boolean(banners.selected?.active));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banners.selectedId]);

  const moveBanner = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    banners.setItems((prev) => {
      const fromIdx = prev.findIndex((x) => x.id === fromId);
      const toIdx = prev.findIndex((x) => x.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      // UI 즉시 반영: sort_order는 drop 이후에 DB 저장
      return next.map((x, idx) => ({ ...x, sort_order: idx }));
    });
  };

  const persistBannerOrder = async () => {
    setSavingOrder(true);
    setBannerError(null);
    try {
      const ids = banners.items.map((b) => b.id);
      await reorderMembershipBanners(ids);
      // 서버 기준으로 재로드(정합성)
      await reloadBanners();
    } catch (e: any) {
      setBannerError(e?.message || "순서 저장에 실패했어요.");
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="멤버십"
          subtitle="멤버십 배너(복수)를 등록하고 프론트 &ldquo;멤버십 가입&rdquo; 화면에 노출합니다."
          right={null}
        />

        <div className="grid gap-6">
          {/* B) 신규: 멤버십 배너 */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-extrabold text-white/80">멤버십 배너(복수)</div>
                <div className="mt-1 text-[12px] font-semibold text-white/40">프론트 &ldquo;멤버십 가입&rdquo; 상단 배너로 노출됩니다.</div>
              </div>
              <div className="flex items-center gap-2">
                <AdminButton variant="ghost" onClick={() => reloadBanners()}>
                  새로고침
                </AdminButton>
                <AdminButton variant="ghost" onClick={() => persistBannerOrder()}>
                  {savingOrder ? "저장중..." : "순서 저장"}
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const row = await createMembershipBanner();
                      banners.setItems((prev) => [...prev, row]);
                      banners.setSelectedId(row.id);
                    } catch (e: any) {
                      setBannerError(e?.message || "추가에 실패했어요.");
                    }
                  }}
                >
                  + 배너 추가
                </AdminButton>
                <AdminButton
                  variant="danger"
                  onClick={async () => {
                    if (!banners.selectedId) return;
                    if (!confirm("선택한 배너를 삭제할까요?")) return;
                    const id = banners.selectedId;
                    try {
                      await deleteMembershipBanner(id);
                      banners.setItems((prev) => prev.filter((x) => x.id !== id));
                      banners.setSelectedId(null);
                    } catch (e: any) {
                      setBannerError(e?.message || "삭제에 실패했어요.");
                    }
                  }}
                >
                  삭제
                </AdminButton>
              </div>
            </div>

            {bannerError ? <div className="mt-3 text-[12px] font-semibold text-[#ff9aa1]">{bannerError}</div> : null}
            {loadingBanners ? <div className="mt-3 text-[12px] font-semibold text-white/45">불러오는 중...</div> : null}

            <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_420px]">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px] font-extrabold text-white/80">배너 목록(드래그로 순서 변경)</div>
                  <div className="text-[11px] font-semibold text-white/35">드롭 후 &ldquo;순서 저장&rdquo;을 눌러주세요.</div>
                </div>

                <div className="mt-3 space-y-2">
                  {banners.items.map((b) => (
                    <div
                      key={b.id}
                      draggable
                      onDragStart={(e) => {
                        setDragId(b.id);
                        try {
                          e.dataTransfer.setData("text/plain", b.id);
                        } catch {}
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = (() => {
                          try {
                            return e.dataTransfer.getData("text/plain");
                          } catch {
                            return "";
                          }
                        })();
                        const fromId = from || dragId;
                        if (!fromId) return;
                        moveBanner(fromId, b.id);
                        setDragId(null);
                      }}
                      onDragEnd={() => setDragId(null)}
                      className={`flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3 ${
                        b.id === banners.selectedId ? "ring-2 ring-[#ff4da7]/40" : ""
                      }`}
                      role="button"
                      tabIndex={0}
                      onClick={() => banners.setSelectedId(b.id)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[14px] font-extrabold text-white/60">
                          ≡
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-extrabold text-white/80">{b.title || "(제목 없음)"}</div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-white/40">
                            <span>order: {b.sort_order}</span>
                            {b.active ? (
                              <span className="rounded-full bg-[#22c55e]/15 px-2 py-[2px] font-extrabold text-[#6ee7b7]">ON</span>
                            ) : (
                              <span className="rounded-full bg-white/10 px-2 py-[2px] font-extrabold text-white/45">OFF</span>
                            )}
                            {b.image_url ? (
                              <span className="rounded-full bg-white/10 px-2 py-[2px] font-extrabold text-white/65">IMG</span>
                            ) : (
                              <span className="rounded-full bg-white/5 px-2 py-[2px] font-extrabold text-white/35">NO IMG</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <AdminButton variant="ghost" onClick={() => banners.setSelectedId(b.id)}>
                        편집
                      </AdminButton>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <div className="text-[13px] font-extrabold text-white/80">배너 편집</div>
                {banners.selected ? (
                  <div className="mt-4 space-y-4">
                    <AdminInput label="제목(alt)" value={bTitle} onChange={setBTitle} />
                    <AdminInput label="클릭 링크(URL)" value={bLinkUrl} onChange={setBLinkUrl} />
                    <AdminInput label="정렬 순서(sort_order)" value={bSortOrder} onChange={setBSortOrder} />

                    <label className="block">
                      <div className="text-[12px] font-bold text-white/55">노출(active)</div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className={`rounded-xl px-4 py-2 text-[12px] font-extrabold ring-1 ring-white/10 ${
                            bActive ? "bg-[#22c55e]/15 text-[#6ee7b7]" : "bg-white/[0.06] text-white/60"
                          }`}
                          onClick={() => setBActive(true)}
                        >
                          ON
                        </button>
                        <button
                          type="button"
                          className={`rounded-xl px-4 py-2 text-[12px] font-extrabold ring-1 ring-white/10 ${
                            !bActive ? "bg-[#ff9aa1]/15 text-[#ff9aa1]" : "bg-white/[0.06] text-white/60"
                          }`}
                          onClick={() => setBActive(false)}
                        >
                          OFF
                        </button>
                      </div>
                    </label>

                    <div>
                      <div className="text-[12px] font-bold text-white/55">배너 이미지</div>
                      <label
                        className="mt-2 block cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/15 p-4 hover:bg-black/20"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (!file || !banners.selected) return;
                          setBannerError(null);
                          try {
                            const { imageUrl, path } = await uploadMembershipBannerImage(banners.selected.id, file);
                            banners.setItems((prev) =>
                              prev.map((x) =>
                                x.id === banners.selected!.id ? { ...x, image_url: imageUrl, image_path: path } : x
                              )
                            );
                          } catch (err: any) {
                            setBannerError(err?.message || "업로드에 실패했어요.");
                          }
                        }}
                      >
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !banners.selected) return;
                            setBannerError(null);
                            try {
                              const { imageUrl, path } = await uploadMembershipBannerImage(banners.selected.id, file);
                              banners.setItems((prev) =>
                                prev.map((x) => (x.id === banners.selected!.id ? { ...x, image_url: imageUrl, image_path: path } : x))
                              );
                            } catch (err: any) {
                              setBannerError(err?.message || "업로드에 실패했어요.");
                            }
                          }}
                        />

                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[12px] font-extrabold text-white/70">드래그앤드롭 또는 클릭하여 이미지 업로드</div>
                            <div className="mt-1 text-[11px] font-semibold text-white/35">bucket: panana-membership</div>
                          </div>
                          <div className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/60">IMAGE</div>
                        </div>

                        {banners.selected?.image_url ? (
                          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                            <div className="relative h-[160px] w-full">
                              <Image
                                src={banners.selected.image_url}
                                alt={banners.selected.title || "membership banner"}
                                fill
                                className="object-cover"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl bg-white/5 p-4 text-[12px] font-semibold text-white/45">이미지 미등록</div>
                        )}
                      </label>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <AdminButton
                        onClick={async () => {
                          if (!banners.selected) return;
                          setBannerError(null);
                          try {
                            const patch: Partial<MembershipBannerRow> = {
                              title: String(bTitle || "").trim(),
                              link_url: String(bLinkUrl || "").trim(),
                              sort_order: Number.isFinite(Number(bSortOrder)) ? Number(bSortOrder) : 0,
                              active: Boolean(bActive),
                            };
                            const row = await updateMembershipBanner(banners.selected.id, patch);
                            banners.setItems((prev) => prev.map((x) => (x.id === row.id ? row : x)));
                          } catch (e: any) {
                            setBannerError(e?.message || "저장에 실패했어요.");
                          }
                        }}
                      >
                        저장
                      </AdminButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-[12px] font-semibold text-white/45">왼쪽에서 배너를 선택해 주세요.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}

