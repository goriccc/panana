"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminInput, AdminSectionHeader, AdminTable, AdminTextarea, useAdminCrudList } from "../_components/AdminUI";
import {
  createThumbnailSet,
  deleteThumbnailSet,
  listThumbnailSets,
  publicUrlFromPath,
  type AirportSection,
  type AirportThumbnailSetRow,
  updateThumbnailSet,
  uploadSetImage,
  uploadSetVideo,
} from "@/lib/pananaAdmin/airportThumbnailSets";

function MediaDropzone({
  label,
  kindLabel,
  accept,
  preview,
  onPick,
}: {
  label: string;
  kindLabel: string;
  accept: string;
  preview: React.ReactNode;
  onPick: (file: File) => void;
}) {
  return (
    <div>
      <div className="text-[12px] font-bold text-white/55">{label}</div>
      <label
        className="mt-2 block cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/15 p-4 hover:bg-black/20"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const file = e.dataTransfer.files?.[0];
          if (file) onPick(file);
        }}
      >
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
          }}
        />

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-extrabold text-white/70">드래그앤드롭 또는 클릭하여 업로드</div>
            <div className="mt-1 text-[11px] font-semibold text-white/35">{kindLabel}</div>
          </div>
          <div className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/60">{kindLabel}</div>
        </div>

        <div className="mt-3">{preview}</div>
      </label>
    </div>
  );
}

type AirportMediaSet = {
  id: string;
  title: string;
  imagePath: string;
  videoPath: string;
  active: boolean;
};

type AirportSentence = {
  id: string;
  text: string;
  active: boolean;
};

const seedImmigrationMedia: AirportMediaSet[] = [];
const seedImmigrationSentences: AirportSentence[] = [
  {
    id: "s-1",
    text: "공항에 도착하니 많은 인파로 붐비고 있다.\n입국심사대에 내 차례가 왔는데...",
    active: true,
  },
];
const seedCompleteMedia: AirportMediaSet[] = [];

function toLocal(row: AirportThumbnailSetRow): AirportMediaSet {
  return {
    id: row.id,
    title: row.title,
    imagePath: row.image_path,
    videoPath: row.video_path,
    active: row.active,
  };
}

export default function AdminAirportFlowClient() {
  const immigrationMedia = useAdminCrudList<AirportMediaSet>(seedImmigrationMedia);
  const immigrationText = useAdminCrudList<AirportSentence>(seedImmigrationSentences);
  const completeMedia = useAdminCrudList<AirportMediaSet>(seedCompleteMedia);

  const [imTitle, setImTitle] = useState(immigrationMedia.selected?.title || "");
  const [imImagePath, setImImagePath] = useState(immigrationMedia.selected?.imagePath || "");
  const [imVideoPath, setImVideoPath] = useState(immigrationMedia.selected?.videoPath || "");

  const [sText, setSText] = useState(immigrationText.selected?.text || "");

  const [cmTitle, setCmTitle] = useState(completeMedia.selected?.title || "");
  const [cmImagePath, setCmImagePath] = useState(completeMedia.selected?.imagePath || "");
  const [cmVideoPath, setCmVideoPath] = useState(completeMedia.selected?.videoPath || "");

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSection = async (section: AirportSection) => {
    const rows = await listThumbnailSets(section);
    return rows.map(toLocal);
  };

  const reload = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [imm, comp] = await Promise.all([loadSection("immigration"), loadSection("complete")]);
      immigrationMedia.setItems(imm);
      completeMedia.setItems(comp);
      if (!immigrationMedia.selectedId && imm[0]?.id) immigrationMedia.setSelectedId(imm[0].id);
      if (!completeMedia.selectedId && comp[0]?.id) completeMedia.setSelectedId(comp[0].id);
    } catch (e: any) {
      setLoadError(e?.message || "데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMemo(() => {
    setImTitle(immigrationMedia.selected?.title || "");
    setImImagePath(immigrationMedia.selected?.imagePath || "");
    setImVideoPath(immigrationMedia.selected?.videoPath || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immigrationMedia.selectedId]);

  useMemo(() => {
    setSText(immigrationText.selected?.text || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immigrationText.selectedId]);

  useMemo(() => {
    setCmTitle(completeMedia.selected?.title || "");
    setCmImagePath(completeMedia.selected?.imagePath || "");
    setCmVideoPath(completeMedia.selected?.videoPath || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeMedia.selectedId]);

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="공항/입국 플로우"
          subtitle="입국심사/입국통과 썸네일(이미지/동영상)을 Supabase(Storage+DB)로 관리합니다."
          right={
            <div className="flex items-center gap-2">
              <AdminButton variant="ghost" onClick={() => reload()}>
                새로고침
              </AdminButton>
            </div>
          }
        />

        {loadError ? <div className="mb-4 text-[12px] font-semibold text-[#ff9aa1]">{loadError}</div> : null}
        {loading ? <div className="mb-4 text-[12px] font-semibold text-white/45">불러오는 중...</div> : null}

        <div className="grid gap-6">
          {/* 1) 입국심사 썸네일 */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-extrabold text-white/80">1) 입국심사 썸네일</div>
                <div className="mt-1 text-[12px] font-semibold text-white/40">이미지/동영상을 등록·수정·삭제할 수 있어요.</div>
              </div>
              <div className="flex gap-2">
                <AdminButton
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const row = await createThumbnailSet("immigration");
                      immigrationMedia.setItems((prev) => [...prev, toLocal(row)]);
                      immigrationMedia.setSelectedId(row.id);
                    } catch (e: any) {
                      setLoadError(e?.message || "추가에 실패했어요.");
                    }
                  }}
                >
                  + 추가
                </AdminButton>
                <AdminButton
                  variant="danger"
                  onClick={async () => {
                    if (!immigrationMedia.selectedId) return;
                    const id = immigrationMedia.selectedId;
                    try {
                      await deleteThumbnailSet(id);
                      immigrationMedia.setItems((prev) => prev.filter((x) => x.id !== id));
                      immigrationMedia.setSelectedId(null);
                    } catch (e: any) {
                      setLoadError(e?.message || "삭제에 실패했어요.");
                    }
                  }}
                >
                  삭제
                </AdminButton>
              </div>
            </div>

            <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_420px]">
              <AdminTable
                columns={[
                  { key: "title", header: "제목" },
                  { key: "image", header: "이미지" },
                  { key: "video", header: "동영상" },
                  { key: "active", header: "노출" },
                  { key: "actions", header: "선택" },
                ]}
                rows={immigrationMedia.items.map((m) => ({
                  title: m.title,
                  image: m.imagePath ? (
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/70">등록됨</span>
                  ) : (
                    <span className="text-[12px] font-semibold text-white/35">미등록</span>
                  ),
                  video: m.videoPath ? (
                    <span className="rounded-full bg-[#4F7CFF]/20 px-2 py-1 text-[11px] font-extrabold text-[#8FB1FF]">등록됨</span>
                  ) : (
                    <span className="text-[12px] font-semibold text-white/35">선택</span>
                  ),
                  active: m.active ? (
                    <span className="rounded-full bg-[#22c55e]/15 px-2 py-1 text-[11px] font-extrabold text-[#6ee7b7]">ON</span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/45">OFF</span>
                  ),
                  actions: (
                    <AdminButton variant="ghost" onClick={() => immigrationMedia.setSelectedId(m.id)}>
                      편집
                    </AdminButton>
                  ),
                }))}
              />

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="text-[13px] font-extrabold text-white/80">편집</div>
                <div className="mt-4 space-y-4">
                  <AdminInput label="세트 제목" value={imTitle} onChange={setImTitle} placeholder="예: 입국심사 썸네일 세트 1" />

                  <MediaDropzone
                    label="이미지 썸네일(필수)"
                    kindLabel="이미지"
                    accept="image/*"
                    preview={
                      imImagePath ? (
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={publicUrlFromPath(imImagePath)} alt="" className="h-[160px] w-full object-cover" />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-6 text-center text-[12px] font-semibold text-white/35">
                          이미지 썸네일을 업로드하세요
                        </div>
                      )
                    }
                    onPick={async (file) => {
                      if (!immigrationMedia.selectedId) {
                        setLoadError("먼저 '+ 추가'로 썸네일 세트를 만든 뒤 업로드하세요.");
                        return;
                      }
                      try {
                        const path = await uploadSetImage("immigration", immigrationMedia.selectedId, file);
                        setImImagePath(path);
                        await updateThumbnailSet(immigrationMedia.selectedId, { image_path: path });
                        immigrationMedia.setItems((prev) =>
                          prev.map((x) => (x.id === immigrationMedia.selectedId ? { ...x, imagePath: path } : x))
                        );
                      } catch (e: any) {
                        setLoadError(e?.message || "이미지 업로드에 실패했어요.");
                      }
                    }}
                  />

                  <MediaDropzone
                    label="동영상 썸네일(선택)"
                    kindLabel="동영상 (이미지→동영상 순서로 보이게)"
                    accept="video/*"
                    preview={
                      imVideoPath ? (
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                          <video
                            src={publicUrlFromPath(imVideoPath)}
                            poster={imImagePath ? publicUrlFromPath(imImagePath) : undefined}
                            className="h-[160px] w-full object-cover"
                            muted
                            playsInline
                            loop
                            autoPlay
                            preload="auto"
                            controls
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-6 text-center text-[12px] font-semibold text-white/35">
                          동영상은 선택 사항이에요 (없어도 OK)
                        </div>
                      )
                    }
                    onPick={async (file) => {
                      if (!immigrationMedia.selectedId) {
                        setLoadError("먼저 '+ 추가'로 썸네일 세트를 만든 뒤 업로드하세요.");
                        return;
                      }
                      try {
                        const path = await uploadSetVideo("immigration", immigrationMedia.selectedId, file);
                        setImVideoPath(path);
                        await updateThumbnailSet(immigrationMedia.selectedId, { video_path: path });
                        immigrationMedia.setItems((prev) =>
                          prev.map((x) => (x.id === immigrationMedia.selectedId ? { ...x, videoPath: path } : x))
                        );
                      } catch (e: any) {
                        setLoadError(e?.message || "동영상 업로드에 실패했어요.");
                      }
                    }}
                  />

                  <div className="flex flex-wrap gap-2">
                    <AdminButton
                      onClick={async () => {
                        if (!immigrationMedia.selectedId) return;
                        try {
                          await updateThumbnailSet(immigrationMedia.selectedId, { title: imTitle.trim() });
                          immigrationMedia.setItems((prev) =>
                            prev.map((x) => (x.id === immigrationMedia.selectedId ? { ...x, title: imTitle.trim() } : x))
                          );
                        } catch (e: any) {
                          setLoadError(e?.message || "저장에 실패했어요.");
                        }
                      }}
                    >
                      저장
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      onClick={async () => {
                        if (!immigrationMedia.selectedId) return;
                        const current = immigrationMedia.items.find((x) => x.id === immigrationMedia.selectedId);
                        if (!current) return;
                        try {
                          const nextActive = !current.active;
                          await updateThumbnailSet(immigrationMedia.selectedId, { active: nextActive });
                          immigrationMedia.setItems((prev) =>
                            prev.map((x) => (x.id === immigrationMedia.selectedId ? { ...x, active: nextActive } : x))
                          );
                        } catch (e: any) {
                          setLoadError(e?.message || "토글에 실패했어요.");
                        }
                      }}
                    >
                      노출 토글
                    </AdminButton>
                  </div>

                  <div className="text-[11px] font-semibold text-white/35">
                    저장 위치: `panana_airport_thumbnail_sets(section=immigration)` + Storage `panana-airport/immigration/&lt;setId&gt;/image , video`
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 1) 입국심사 문장 (현재는 더미, 향후 panana_airport_copy로 연결) */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-extrabold text-white/80">1) 입국심사 안내 문장</div>
                <div className="mt-1 text-[12px] font-semibold text-white/40">문장을 등록·수정·삭제할 수 있어요(줄바꿈 유지).</div>
              </div>
              <div className="flex gap-2">
                <AdminButton
                  variant="ghost"
                  onClick={() => {
                    const id = `s-${Date.now()}`;
                    immigrationText.setItems((prev) => [...prev, { id, text: "", active: true }]);
                    immigrationText.setSelectedId(id);
                  }}
                >
                  + 추가
                </AdminButton>
                <AdminButton
                  variant="danger"
                  onClick={() => {
                    if (!immigrationText.selectedId) return;
                    immigrationText.setItems((prev) => prev.filter((x) => x.id !== immigrationText.selectedId));
                    immigrationText.setSelectedId(null);
                  }}
                >
                  삭제
                </AdminButton>
              </div>
            </div>

            <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_420px]">
              <AdminTable
                columns={[
                  { key: "text", header: "문장" },
                  { key: "active", header: "노출" },
                  { key: "actions", header: "선택" },
                ]}
                rows={immigrationText.items.map((s) => ({
                  text: <span className="line-clamp-2 max-w-[720px] whitespace-pre-line text-white/70">{s.text || "-"}</span>,
                  active: s.active ? (
                    <span className="rounded-full bg-[#22c55e]/15 px-2 py-1 text-[11px] font-extrabold text-[#6ee7b7]">ON</span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/45">OFF</span>
                  ),
                  actions: (
                    <AdminButton variant="ghost" onClick={() => immigrationText.setSelectedId(s.id)}>
                      편집
                    </AdminButton>
                  ),
                }))}
              />

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="text-[13px] font-extrabold text-white/80">편집</div>
                <div className="mt-4 space-y-4">
                  <AdminTextarea label="문장" value={sText} onChange={setSText} rows={6} />
                  <div className="flex flex-wrap gap-2">
                    <AdminButton
                      onClick={() => {
                        if (!immigrationText.selected) return;
                        immigrationText.setItems((prev) =>
                          prev.map((x) => (x.id === immigrationText.selected!.id ? { ...x, text: sText } : x))
                        );
                      }}
                    >
                      저장
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      onClick={() => {
                        if (!immigrationText.selected) return;
                        immigrationText.setItems((prev) =>
                          prev.map((x) => (x.id === immigrationText.selected!.id ? { ...x, active: !x.active } : x))
                        );
                      }}
                    >
                      노출 토글
                    </AdminButton>
                  </div>
                  <div className="text-[11px] font-semibold text-white/35">Supabase 연동 시: `panana_airport_copy(key=immigration_intro)`로 관리 권장.</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2) 입국통과 썸네일 */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-extrabold text-white/80">2) 입국통과 썸네일</div>
                <div className="mt-1 text-[12px] font-semibold text-white/40">이미지/동영상을 등록·수정·삭제할 수 있어요.</div>
              </div>
              <div className="flex gap-2">
                <AdminButton
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const row = await createThumbnailSet("complete");
                      completeMedia.setItems((prev) => [...prev, toLocal(row)]);
                      completeMedia.setSelectedId(row.id);
                    } catch (e: any) {
                      setLoadError(e?.message || "추가에 실패했어요.");
                    }
                  }}
                >
                  + 추가
                </AdminButton>
                <AdminButton
                  variant="danger"
                  onClick={async () => {
                    if (!completeMedia.selectedId) return;
                    const id = completeMedia.selectedId;
                    try {
                      await deleteThumbnailSet(id);
                      completeMedia.setItems((prev) => prev.filter((x) => x.id !== id));
                      completeMedia.setSelectedId(null);
                    } catch (e: any) {
                      setLoadError(e?.message || "삭제에 실패했어요.");
                    }
                  }}
                >
                  삭제
                </AdminButton>
              </div>
            </div>

            <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_420px]">
              <AdminTable
                columns={[
                  { key: "title", header: "제목" },
                  { key: "image", header: "이미지" },
                  { key: "video", header: "동영상" },
                  { key: "active", header: "노출" },
                  { key: "actions", header: "선택" },
                ]}
                rows={completeMedia.items.map((m) => ({
                  title: m.title,
                  image: m.imagePath ? (
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/70">등록됨</span>
                  ) : (
                    <span className="text-[12px] font-semibold text-white/35">미등록</span>
                  ),
                  video: m.videoPath ? (
                    <span className="rounded-full bg-[#4F7CFF]/20 px-2 py-1 text-[11px] font-extrabold text-[#8FB1FF]">등록됨</span>
                  ) : (
                    <span className="text-[12px] font-semibold text-white/35">선택</span>
                  ),
                  active: m.active ? (
                    <span className="rounded-full bg-[#22c55e]/15 px-2 py-1 text-[11px] font-extrabold text-[#6ee7b7]">ON</span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/45">OFF</span>
                  ),
                  actions: (
                    <AdminButton variant="ghost" onClick={() => completeMedia.setSelectedId(m.id)}>
                      편집
                    </AdminButton>
                  ),
                }))}
              />

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="text-[13px] font-extrabold text-white/80">편집</div>
                <div className="mt-4 space-y-4">
                  <AdminInput label="세트 제목" value={cmTitle} onChange={setCmTitle} placeholder="예: 입국통과 썸네일 세트 1" />

                  <MediaDropzone
                    label="이미지 썸네일(필수)"
                    kindLabel="이미지"
                    accept="image/*"
                    preview={
                      cmImagePath ? (
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={publicUrlFromPath(cmImagePath)} alt="" className="h-[160px] w-full object-cover" />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-6 text-center text-[12px] font-semibold text-white/35">
                          이미지 썸네일을 업로드하세요
                        </div>
                      )
                    }
                    onPick={async (file) => {
                      if (!completeMedia.selectedId) {
                        setLoadError("먼저 '+ 추가'로 썸네일 세트를 만든 뒤 업로드하세요.");
                        return;
                      }
                      try {
                        const path = await uploadSetImage("complete", completeMedia.selectedId, file);
                        setCmImagePath(path);
                        await updateThumbnailSet(completeMedia.selectedId, { image_path: path });
                        completeMedia.setItems((prev) =>
                          prev.map((x) => (x.id === completeMedia.selectedId ? { ...x, imagePath: path } : x))
                        );
                      } catch (e: any) {
                        setLoadError(e?.message || "이미지 업로드에 실패했어요.");
                      }
                    }}
                  />

                  <MediaDropzone
                    label="동영상 썸네일(선택)"
                    kindLabel="동영상 (이미지→동영상 순서로 보이게)"
                    accept="video/*"
                    preview={
                      cmVideoPath ? (
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                          <video
                            src={publicUrlFromPath(cmVideoPath)}
                            poster={cmImagePath ? publicUrlFromPath(cmImagePath) : undefined}
                            className="h-[160px] w-full object-cover"
                            muted
                            playsInline
                            loop
                            autoPlay
                            preload="auto"
                            controls
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-6 text-center text-[12px] font-semibold text-white/35">
                          동영상은 선택 사항이에요 (없어도 OK)
                        </div>
                      )
                    }
                    onPick={async (file) => {
                      if (!completeMedia.selectedId) {
                        setLoadError("먼저 '+ 추가'로 썸네일 세트를 만든 뒤 업로드하세요.");
                        return;
                      }
                      try {
                        const path = await uploadSetVideo("complete", completeMedia.selectedId, file);
                        setCmVideoPath(path);
                        await updateThumbnailSet(completeMedia.selectedId, { video_path: path });
                        completeMedia.setItems((prev) =>
                          prev.map((x) => (x.id === completeMedia.selectedId ? { ...x, videoPath: path } : x))
                        );
                      } catch (e: any) {
                        setLoadError(e?.message || "동영상 업로드에 실패했어요.");
                      }
                    }}
                  />

                  <div className="flex flex-wrap gap-2">
                    <AdminButton
                      onClick={async () => {
                        if (!completeMedia.selectedId) return;
                        try {
                          await updateThumbnailSet(completeMedia.selectedId, { title: cmTitle.trim() });
                          completeMedia.setItems((prev) =>
                            prev.map((x) => (x.id === completeMedia.selectedId ? { ...x, title: cmTitle.trim() } : x))
                          );
                        } catch (e: any) {
                          setLoadError(e?.message || "저장에 실패했어요.");
                        }
                      }}
                    >
                      저장
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      onClick={async () => {
                        if (!completeMedia.selectedId) return;
                        const current = completeMedia.items.find((x) => x.id === completeMedia.selectedId);
                        if (!current) return;
                        try {
                          const nextActive = !current.active;
                          await updateThumbnailSet(completeMedia.selectedId, { active: nextActive });
                          completeMedia.setItems((prev) =>
                            prev.map((x) => (x.id === completeMedia.selectedId ? { ...x, active: nextActive } : x))
                          );
                        } catch (e: any) {
                          setLoadError(e?.message || "토글에 실패했어요.");
                        }
                      }}
                    >
                      노출 토글
                    </AdminButton>
                  </div>

                  <div className="text-[11px] font-semibold text-white/35">
                    저장 위치: `panana_airport_thumbnail_sets(section=complete)` + Storage `panana-airport/complete/&lt;setId&gt;/image , video`
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}

