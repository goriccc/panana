"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminInput, AdminSectionHeader, AdminTable, AdminTextarea } from "../_components/AdminUI";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { deleteCharacterProfileImageByUrl, uploadCharacterProfileImage } from "@/lib/pananaAdmin/characterProfileImage";
import { StudioConfirmDialog, StudioFormDialog } from "@/app/studio/_components/StudioDialogs";

type CharacterRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  handle: string;
  hashtags: string[];
  mbti: string;
  introTitle: string;
  introLines: string[];
  moodTitle: string;
  moodLines: string[];
  followersCount: number;
  followingCount: number;
  profileImageUrl: string;
  postsCount: number;
  studioCharacterId: string | null;
  safetySupported: boolean; // 세이프티 지원(성인 대화 가능)
  active: boolean;
  categoryIds: string[]; // 홈 카테고리 노출 연결 (FK)
  adminNotes: string; // 어드민 내부 운영 메모(비공개)
};

type CategoryRow = { id: string; slug: string; title: string };
type StudioCharacterPick = { id: string; slug: string; name: string; project_id: string; status: string };
type StudioProjectPick = { id: string; title: string };

export default function AdminCharactersPage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [rows, setRows] = useState<CharacterRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(rows.length / pageSize)), [rows.length]);
  const pagedRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page]);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [studioCharacters, setStudioCharacters] = useState<StudioCharacterPick[]>([]);
  const [studioProjects, setStudioProjects] = useState<StudioProjectPick[]>([]);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [handle, setHandle] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [mbti, setMbti] = useState("");
  const [introTitle, setIntroTitle] = useState("");
  const [introLinesText, setIntroLinesText] = useState("");
  const [moodTitle, setMoodTitle] = useState("");
  const [moodLinesText, setMoodLinesText] = useState("");
  const [followersCount, setFollowersCount] = useState("0");
  const [followingCount, setFollowingCount] = useState("0");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [postsCount, setPostsCount] = useState("0");
  const [studioCharacterId, setStudioCharacterId] = useState<string>("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [safetySupported, setSafetySupported] = useState(false);

  const [studioPreview, setStudioPreview] = useState<{
    character?: {
      id: string;
      name: string;
      handle: string;
      hashtags: string[];
      tagline: string;
      intro_title: string;
      intro_lines: string[];
      mood_title: string;
      mood_lines: string[];
    } | null;
    operatorMemo?: string;
  } | null>(null);

  const [studioAutofilled, setStudioAutofilled] = useState<
    Partial<Record<"name" | "handle" | "hashtags" | "tagline" | "intro" | "mood" | "notes", boolean>>
  >({});

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [missingAdminNotesColumn, setMissingAdminNotesColumn] = useState(false);
  const [missingSafetySupportedColumn, setMissingSafetySupportedColumn] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteImageOpen, setDeleteImageOpen] = useState(false);
  const [deleteImageBusy, setDeleteImageBusy] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  const triggerRevalidate = async (paths: string[]) => {
    try {
      const unique = Array.from(new Set(paths.filter(Boolean)));
      if (!unique.length) return;
      await fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: unique }),
      });
    } catch {
      // ignore
    }
  };

  const getCategoryPaths = (ids: string[]) =>
    ids
      .map((id) => categories.find((c) => c.id === id)?.slug)
      .filter(Boolean)
      .map((slug) => `/category/${slug}`);

  const triggerRevalidateForCurrent = (extra: string[] = []) => {
    const profilePath = slug.trim() ? `/c/${slug.trim()}` : "";
    void triggerRevalidate(["/", "/home", profilePath, ...getCategoryPaths(categoryIds), ...extra]);
  };

  const makeNewCharacterSlug = () => {
    const used = new Set(rows.map((r) => String(r.slug || "").toLowerCase()).filter(Boolean));
    const base = `new-character`;
    if (!used.has(base)) return base;
    for (let i = 2; i <= 200; i++) {
      const s = `${base}-${i}`;
      if (!used.has(s)) return s;
    }
    return `${base}-${Date.now().toString().slice(-6)}`;
  };

  const onPickProfileImage = async (file: File) => {
    if (!selectedId) {
      setErr("먼저 캐릭터를 선택/생성한 뒤 업로드하세요.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErr("이미지 파일만 업로드할 수 있어요.");
      return;
    }
    setErr(null);
    setUploading(true);
    try {
      if (profileImageUrl) {
        await deleteCharacterProfileImageByUrl(profileImageUrl);
      }
      const { publicUrl } = await uploadCharacterProfileImage(selectedId, file);
      setProfileImageUrl(publicUrl);
    } catch (e: any) {
      setErr(e?.message || "업로드에 실패했어요. (STORAGE_CHARACTERS.sql 실행 여부도 확인해주세요)");
    } finally {
      setUploading(false);
    }
  };

  const parseHashtags = (s: string) => {
    const raw = s
      .split(/[,\n]/g)
      .map((x) => x.trim())
      .filter(Boolean);
    const cleaned = raw.map((x) => x.replace(/^#/, ""));
    return Array.from(new Set(cleaned)).slice(0, 30);
  };

  const splitLines = (s: string) =>
    s
      .split("\n")
      .map((x) => x.replace(/\r/g, ""))
      .filter((x) => x.trim().length > 0 || x === "");

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const baseCharSelect = [
        "id",
        "slug",
        "name",
        "tagline",
        "handle",
        "hashtags",
        "mbti",
        "intro_title",
        "intro_lines",
        "mood_title",
        "mood_lines",
        "followers_count",
        "following_count",
        "profile_image_url",
        "posts_count",
        "studio_character_id",
        "active",
        ...(missingSafetySupportedColumn ? [] : ["safety_supported"]),
      ].join(", ");
      const charSelect = missingAdminNotesColumn ? baseCharSelect : `${baseCharSelect}, admin_notes`;

      const [catRes, charRes0, mapRes, studioCharRes, studioProjRes] = await Promise.all([
        supabase.from("panana_categories").select("id, slug, title").order("sort_order", { ascending: true }),
        supabase
          .from("panana_characters")
          .select(
            charSelect
          )
          .order("updated_at", { ascending: false }),
        supabase.from("panana_character_categories").select("character_id, category_id").eq("active", true),
        supabase
          .from("characters")
          .select("id, slug, name, project_id, status")
          .eq("status", "published")
          .order("updated_at", { ascending: false }),
        supabase.from("projects").select("id, title").order("updated_at", { ascending: false }),
      ]);

      if (catRes.error) throw catRes.error;
      let charRes = charRes0;
      if (charRes.error) {
        const msg = String((charRes.error as any)?.message || "");
        const code = String((charRes.error as any)?.code || "");
        const missingAdminNotes =
          code === "42703" ||
          msg.includes("admin_notes") ||
          (msg.includes("column") && msg.includes("admin_notes") && msg.includes("does not exist"));
        const missingSafety =
          code === "42703" ||
          msg.includes("safety_supported") ||
          (msg.includes("column") && msg.includes("safety_supported") && msg.includes("does not exist"));

        if (missingSafety && !missingSafetySupportedColumn) {
          setMissingSafetySupportedColumn(true);
          // retry with safety_supported omitted
          const baseRetry = [
            "id",
            "slug",
            "name",
            "tagline",
            "handle",
            "hashtags",
            "mbti",
            "intro_title",
            "intro_lines",
            "mood_title",
            "mood_lines",
            "followers_count",
            "following_count",
            "profile_image_url",
            "posts_count",
            "studio_character_id",
            "active",
          ].join(", ");
          const retrySelect = missingAdminNotesColumn ? baseRetry : `${baseRetry}, admin_notes`;
          const retry = await supabase.from("panana_characters").select(retrySelect).order("updated_at", { ascending: false });
          if (retry.error) throw retry.error;
          charRes = retry as any;
          setErr("DB에 safety_supported 컬럼이 없어요. `docs/panana-admin/MIGRATE_CHARACTER_SAFETY_SUPPORTED.sql` 실행 후 스파이시 지원 캐릭터 설정이 활성화됩니다.");
        } else if (missingAdminNotes && !missingAdminNotesColumn) {
          setMissingAdminNotesColumn(true);
          // retry without admin_notes
          const retry = await supabase.from("panana_characters").select(baseCharSelect).order("updated_at", { ascending: false });
          if (retry.error) throw retry.error;
          charRes = retry as any;
          setErr("DB에 admin_notes 컬럼이 없어요. `docs/panana-admin/MIGRATE_CHARACTER_ADMIN_NOTES.sql`을 실행하면 메모 저장이 활성화됩니다.");
        } else {
          throw charRes.error;
        }
      }
      if (mapRes.error) throw mapRes.error;
      if (studioCharRes.error) throw studioCharRes.error;
      if (studioProjRes.error) throw studioProjRes.error;

      const cats = (catRes.data || []) as any as CategoryRow[];
      setCategories(cats);

      const map = new Map<string, string[]>();
      (mapRes.data || []).forEach((m: any) => {
        const arr = map.get(m.character_id) || [];
        arr.push(m.category_id);
        map.set(m.character_id, arr);
      });

      const list: CharacterRow[] = (charRes.data || []).map((r: any) => ({
        id: r.id,
        slug: r.slug || "",
        name: r.name || "",
        tagline: r.tagline || "",
        handle: r.handle || "",
        hashtags: Array.isArray(r.hashtags) ? r.hashtags : [],
        mbti: r.mbti || "",
        introTitle: r.intro_title || "소개합니다!",
        introLines: Array.isArray(r.intro_lines) ? r.intro_lines : [],
        moodTitle: r.mood_title || "요즘 어때?",
        moodLines: Array.isArray(r.mood_lines) ? r.mood_lines : [],
        followersCount: Number(r.followers_count || 0),
        followingCount: Number(r.following_count || 0),
        profileImageUrl: r.profile_image_url || "",
        postsCount: Number(r.posts_count || 0),
        studioCharacterId: r.studio_character_id || null,
        safetySupported: Boolean(r.safety_supported),
        active: Boolean(r.active),
        categoryIds: map.get(r.id) || [],
        adminNotes: r.admin_notes || "",
      }));
      setRows(list);

      setStudioCharacters((studioCharRes.data || []) as any);
      setStudioProjects((studioProjRes.data || []) as any);

      // 선택된 항목이 삭제되었거나 목록에 없으면 첫 번째 항목으로 안전하게 이동
      if (selectedId && !list.some((x) => x.id === selectedId)) {
        setSelectedId(list[0]?.id || null);
      } else if (!selectedId && list[0]?.id) {
        setSelectedId(list[0].id);
      }
    } catch (e: any) {
      setErr(e?.message || "불러오기에 실패했어요. (MIGRATE_CHARACTER_META.sql 실행 여부도 확인해주세요)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) {
      // 선택된 캐릭터가 없으면(삭제/리스트 변경 등) 편집 폼을 초기화
      setSlug("");
      setName("");
      setTagline("");
      setHandle("");
      setHashtagsText("");
      setMbti("");
      setIntroTitle("소개합니다!");
      setIntroLinesText("");
      setMoodTitle("요즘 어때?");
      setMoodLinesText("");
      setFollowersCount("0");
      setFollowingCount("0");
      setProfileImageUrl("");
      setPostsCount("0");
      setStudioCharacterId("");
      setCategoryIds([]);
      setNotes("");
      setSafetySupported(false);
      setStudioPreview(null);
      setStudioAutofilled({});
      return;
    }

    setSlug(selected.slug);
    setName(selected.name);
    setTagline(selected.tagline);
    setHandle(selected.handle);
    setHashtagsText(selected.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(", "));
    setMbti(selected.mbti);
    setIntroTitle(selected.introTitle);
    setIntroLinesText((selected.introLines || []).join("\n"));
    setMoodTitle(selected.moodTitle);
    setMoodLinesText((selected.moodLines || []).join("\n"));
    setFollowersCount(String(selected.followersCount || 0));
    setFollowingCount(String(selected.followingCount || 0));
    setProfileImageUrl(selected.profileImageUrl);
    setPostsCount(String(selected.postsCount || 0));
    setStudioCharacterId(selected.studioCharacterId || "");
    setCategoryIds(selected.categoryIds || []);
    setNotes(selected.adminNotes || "");
    setSafetySupported(Boolean(selected.safetySupported));
    setStudioPreview(null);
    setStudioAutofilled({});
  }, [selectedId, selected]);

  useEffect(() => {
    setPage((current) => Math.min(Math.max(current, 1), pageCount));
  }, [pageCount]);

  const tryAutofillFromStudioOnce = async (nextStudioCharacterId: string) => {
    if (!nextStudioCharacterId) return;

    // A: "비어있는 필드만" 1회 자동 채움. (이미 값이 있으면 절대 덮어쓰지 않음)
    try {
      const [{ data: sChar, error: sCharErr }, { data: sPrompt, error: sPromptErr }] = await Promise.all([
        supabase
          .from("characters")
          .select("id, name, handle, hashtags, tagline, intro_title, intro_lines, mood_title, mood_lines")
          .eq("id", nextStudioCharacterId)
          .maybeSingle(),
        supabase.from("character_prompts").select("payload").eq("character_id", nextStudioCharacterId).maybeSingle(),
      ]);

      const sc: any = sChar || {};
      const memo = String((sPrompt as any)?.payload?.meta?.operatorMemo || "").trim();
      const nsfwFilterOff = Boolean((sPrompt as any)?.payload?.author?.nsfwFilterOff);
      setStudioPreview({
        character: sCharErr ? null : (sChar as any),
        operatorMemo: sPromptErr ? "" : memo,
      });

      // 1) 운영자 메모 → 어드민 메모(내부용)
      const filled: any = {};
      if (!notes.trim()) {
        if (memo) setNotes(memo);
        if (memo) filled.notes = true;
      }

      // 2) 공개 프로필 메타(이름/핸들/태그/소개/상태) → 어드민 필드들(비어있을 때만)
      if (!name.trim() && sc?.name) {
        setName(String(sc.name));
        filled.name = true;
      }

      if (!handle.trim() && sc?.handle) {
        const h = String(sc.handle).trim();
        setHandle(h.startsWith("@") ? h : `@${h}`);
        filled.handle = true;
      }

      if (!hashtagsText.trim() && Array.isArray(sc?.hashtags) && sc.hashtags.length) {
        const text = sc.hashtags.map((t: string) => (String(t).startsWith("#") ? String(t) : `#${String(t)}`)).join(", ");
        setHashtagsText(text);
        filled.hashtags = true;
      }

      if (!tagline.trim() && sc?.tagline) {
        setTagline(String(sc.tagline));
        filled.tagline = true;
      }

      // 3) 스파이시 지원: Studio prompt의 nsfwFilterOff(성인 전용) → Panana 노출용 safety_supported
      if (!missingSafetySupportedColumn && !safetySupported && nsfwFilterOff) {
        setSafetySupported(true);
        (filled as any).safety = true;
      }

      // intro/mood는 어드민 기본값("소개합니다!","요즘 어때?")만 있고 라인이 비어있으면 사실상 미설정으로 보고 채움
      const introIsEmptyLike = (!introLinesText.trim()) && (introTitle.trim() === "" || introTitle.trim() === "소개합니다!");
      if (introIsEmptyLike) {
        if (sc?.intro_title && !introTitle.trim()) setIntroTitle(String(sc.intro_title));
        if (Array.isArray(sc?.intro_lines) && sc.intro_lines.length) setIntroLinesText(sc.intro_lines.join("\n"));
        if (sc?.intro_title || (Array.isArray(sc?.intro_lines) && sc.intro_lines.length)) filled.intro = true;
      }

      const moodIsEmptyLike = (!moodLinesText.trim()) && (moodTitle.trim() === "" || moodTitle.trim() === "요즘 어때?");
      if (moodIsEmptyLike) {
        if (sc?.mood_title && !moodTitle.trim()) setMoodTitle(String(sc.mood_title));
        if (Array.isArray(sc?.mood_lines) && sc.mood_lines.length) setMoodLinesText(sc.mood_lines.join("\n"));
        if (sc?.mood_title || (Array.isArray(sc?.mood_lines) && sc.mood_lines.length)) filled.mood = true;
      }

      if (Object.keys(filled).length) {
        setStudioAutofilled((prev) => ({ ...prev, ...filled }));
      }
    } catch {
      // ignore
    }
  };

  const StudioBadge = ({ show }: { show?: boolean }) =>
    show ? (
      <span className="ml-2 inline-flex items-center rounded-full bg-[#4F7CFF]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#8FB1FF] ring-1 ring-[#4F7CFF]/25">
        Studio
      </span>
    ) : null;

  const labelWithStudio = (labelText: string, show?: boolean) => (
    <span className="inline-flex items-center">
      {labelText}
      <StudioBadge show={show} />
    </span>
  );

  const AdminLinkButton = ({
    href,
    label,
    variant = "ghost",
    external = false,
    disabled = false,
  }: {
    href: string;
    label: string;
    variant?: "primary" | "ghost" | "danger";
    external?: boolean;
    disabled?: boolean;
  }) => {
    const cls =
      variant === "primary"
        ? "bg-[#ff4da7] text-white"
        : variant === "danger"
          ? "bg-[#ff3d4a] text-white"
          : "bg-white/[0.03] text-white/80 ring-1 ring-white/10 hover:bg-white/[0.05]";
    if (disabled) {
      return (
        <span className={`inline-flex items-center rounded-xl px-4 py-2 text-[12px] font-extrabold opacity-40 ${cls}`}>
          {label}
        </span>
      );
    }
    return (
      <Link
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={`inline-flex items-center rounded-xl px-4 py-2 text-[12px] font-extrabold ${cls}`}
      >
        {label}
      </Link>
    );
  };

  const applyStudioName = () => {
    const sName = String(studioPreview?.character?.name || "").trim();
    if (!sName) return;
    setName(sName);
    setStudioAutofilled((prev) => ({ ...prev, name: true }));
  };

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="캐릭터"
          subtitle="홈/카테고리/프로필에 노출될 캐릭터 메타 + Studio(저작) 캐릭터 연결을 관리합니다."
          right={
            <>
              <AdminButton variant="ghost" onClick={() => load()}>
                새로고침
              </AdminButton>
              <AdminButton
                variant="ghost"
                onClick={async () => {
                  setErr(null);
                  setCreateName("");
                  setCreateOpen(true);
                }}
              >
                + 새 캐릭터
              </AdminButton>
            </>
          }
        />

        {err ? <div className="mb-4 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
        {loading ? <div className="mb-4 text-[12px] font-semibold text-white/45">불러오는 중...</div> : null}

        <div>
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] font-semibold text-white/45">
              <div>
                {rows.length === 0
                  ? "0개"
                  : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, rows.length)} / ${rows.length}개`}
              </div>
              <div className="flex items-center gap-2">
                <AdminButton variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  이전
                </AdminButton>
                <span className="text-white/60">{page} / {pageCount}</span>
                <AdminButton variant="ghost" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>
                  다음
                </AdminButton>
              </div>
            </div>
            <AdminTable
              columns={[
                { key: "name", header: "이름" },
                { key: "slug", header: "슬러그" },
                { key: "handle", header: "@핸들" },
                { key: "categories", header: "카테고리" },
                { key: "active", header: "노출" },
                { key: "actions", header: "선택" },
              ]}
              rows={pagedRows.map((c) => ({
                name: c.name,
                slug: <span className="text-white/55">{c.slug}</span>,
                handle: <span className="text-white/55">{c.handle ? (c.handle.startsWith("@") ? c.handle : `@${c.handle}`) : "-"}</span>,
                categories: (
                  <div className="flex flex-wrap gap-2">
                    {c.categoryIds.length ? (
                      c.categoryIds.map((id) => {
                        const cat = categories.find((x) => x.id === id);
                        return (
                          <span key={id} className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/70">
                            {cat?.title || id}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[12px] font-semibold text-white/35">미설정</span>
                    )}
                  </div>
                ),
                active: c.active ? (
                  <span className="rounded-full bg-[#22c55e]/15 px-2 py-1 text-[11px] font-extrabold text-[#6ee7b7]">ON</span>
                ) : (
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/45">OFF</span>
                ),
                actions: (
                  <AdminButton
                    variant="ghost"
                    onClick={() => {
                      setSelectedId(c.id);
                      setEditOpen(true);
                    }}
                  >
                    편집
                  </AdminButton>
                ),
              }))}
            />
          </div>

          <div
            className={`fixed inset-0 z-50 ${editOpen ? "" : "hidden"}`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setEditOpen(false);
            }}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
              onMouseDown={() => setEditOpen(false)}
            />
              <div className="absolute inset-0 grid place-items-center px-6">
                <div className="relative w-full max-w-[980px] max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0B0F18] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] font-extrabold text-white/80">편집</div>
                    <AdminButton variant="ghost" onClick={() => setEditOpen(false)}>
                      닫기
                    </AdminButton>
                  </div>
                  {!selected ? <div className="mt-3 text-[12px] font-semibold text-white/35">왼쪽에서 캐릭터를 선택하세요.</div> : null}

                  <div className="mt-4 space-y-4">
              {/* 빠른 연결 확인용: 프론트/채팅/Studio 바로가기 */}
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="text-[12px] font-extrabold text-white/70">바로가기</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <AdminLinkButton
                    href={slug.trim() ? `/c/${slug.trim()}` : "#"}
                    label="프론트 프로필"
                    external
                    disabled={!slug.trim()}
                  />
                  <AdminLinkButton
                    href={slug.trim() ? `/c/${slug.trim()}/chat` : "#"}
                    label="프론트 채팅"
                    external
                    disabled={!slug.trim()}
                  />
                  <AdminLinkButton
                    href={studioCharacterId ? `/studio/characters/${studioCharacterId}` : "#"}
                    label="Studio 캐릭터"
                    external
                    disabled={!studioCharacterId}
                  />
                </div>
                <div className="mt-2 text-[11px] font-semibold text-white/35">
                  Tip: 프론트 채팅이 Studio 프롬프트를 쓰려면 <span className="text-white/60">Studio 캐릭터 연결</span>이 필요합니다.
                </div>
              </div>

              <AdminInput label={labelWithStudio("슬러그", false)} value={slug} onChange={setSlug} placeholder="예: kim-seol-a" />
              <AdminInput label={labelWithStudio("이름", studioAutofilled.name)} value={name} onChange={setName} placeholder="예: 김설아" />
              <AdminInput label={labelWithStudio("@핸들 (author)", studioAutofilled.handle)} value={handle} onChange={setHandle} placeholder="예: spinner (또는 @spinner)" />
              <AdminInput
                label={labelWithStudio("태그(해시태그, 콤마 구분)", studioAutofilled.hashtags)}
                value={hashtagsText}
                onChange={setHashtagsText}
                placeholder="#여사친, #고백공격"
              />
              <AdminInput label="MBTI" value={mbti} onChange={setMbti} placeholder="예: INFP" />
              <AdminInput
                label={labelWithStudio("한 줄 소개(카드 description)", studioAutofilled.tagline)}
                value={tagline}
                onChange={setTagline}
                placeholder="예: 따뜻하지만 시크한 너의 친구"
              />
              <div>
                <div className="text-[12px] font-bold text-white/55">프로필 이미지</div>
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
                    if (file) void onPickProfileImage(file);
                  }}
                >
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onPickProfileImage(file);
                    }}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-extrabold text-white/70">
                        드래그앤드롭 또는 클릭하여 업로드
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-white/35">
                        권장: 정사각(1:1) 이미지, 512px 이상
                      </div>
                    </div>
                    <div className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/60">
                      {uploading ? "업로드중..." : "IMAGE"}
                    </div>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/25">
                    {profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profileImageUrl} alt="" className="h-[160px] w-full object-contain bg-black/20" />
                    ) : (
                      <div className="grid h-[160px] place-items-center text-[12px] font-semibold text-white/35">
                        아직 업로드된 이미지가 없어요
                      </div>
                    )}
                  </div>
                </label>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-[11px] font-semibold text-white/35">
                    {profileImageUrl ? profileImageUrl : ""}
                  </div>
                  {profileImageUrl ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-white/[0.06] px-3 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
                        onClick={() => setImagePreviewOpen(true)}
                      >
                        크게보기
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-white/[0.06] px-3 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
                        onClick={async () => {
                          setDeleteImageOpen(true);
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <AdminInput label="팔로워 수" value={followersCount} onChange={setFollowersCount} placeholder="0" />
                <AdminInput label="팔로잉 수" value={followingCount} onChange={setFollowingCount} placeholder="0" />
              </div>
              <AdminInput label="게시물 개수" value={postsCount} onChange={setPostsCount} placeholder="0" />

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[12px] font-extrabold text-white/70">Studio 캐릭터 연결(저작 데이터)</div>
                <div className="mt-3">
                  <select
                    value={studioCharacterId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStudioCharacterId(v);
                      void tryAutofillFromStudioOnce(v);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[13px] font-semibold text-white/80 outline-none"
                  >
                    <option value="">(연결 안 함)</option>
                    {studioCharacters
                      .filter((c) => {
                        // 이미 다른 캐릭터에 연결된 Studio 캐릭터는 제외
                        // 단, 현재 선택된 캐릭터가 이미 연결한 것은 제외하지 않음 (자기 자신은 선택 가능)
                        const alreadyLinked = rows.some(
                          (r) => r.studioCharacterId === c.id && r.id !== selectedId
                        );
                        return !alreadyLinked;
                      })
                      .map((c) => {
                        const p = studioProjects.find((x) => x.id === c.project_id)?.title || c.project_id;
                        return (
                          <option key={c.id} value={c.id}>
                            [{p}] {c.name} ({c.slug})
                          </option>
                        );
                      })}
                  </select>
                </div>
                <div className="mt-2 text-[11px] font-semibold text-white/35">
                  연결하면 채팅 API가 Studio의 prompt/lorebook를 로드해 system prompt에 주입합니다.
                </div>

                {studioPreview?.character ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[11px] font-extrabold text-white/55">Studio 미리보기(읽기 전용)</div>
                    <div className="mt-2 space-y-1 text-[11px] font-semibold text-white/45">
                      <div>
                        이름: <span className="text-white/80">{studioPreview.character.name || "-"}</span>
                      </div>
                      <div>
                        핸들: <span className="text-white/80">{studioPreview.character.handle ? `@${studioPreview.character.handle.replace(/^@/, "")}` : "-"}</span>
                      </div>
                      <div>
                        태그:{" "}
                        <span className="text-white/80">
                          {Array.isArray(studioPreview.character.hashtags) && studioPreview.character.hashtags.length
                            ? studioPreview.character.hashtags.map((t) => `#${String(t).replace(/^#/, "")}`).join(", ")
                            : "-"}
                        </span>
                      </div>
                      <div>
                        한줄소개: <span className="text-white/80">{studioPreview.character.tagline || "-"}</span>
                      </div>
                      <div className="pt-1 text-white/35">※ 어드민 필드가 비어있을 때만 1회 자동 채움됩니다.</div>
                    </div>

                    {studioPreview.character.name && studioPreview.character.name !== name.trim() ? (
                      <button
                        type="button"
                        className="mt-3 w-full rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
                        onClick={applyStudioName}
                      >
                        이름만 Studio로 맞추기
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[12px] font-extrabold text-white/70">프로필 소개</div>
                <AdminInput
                  label={labelWithStudio("소개 타이틀", studioAutofilled.intro)}
                  value={introTitle}
                  onChange={setIntroTitle}
                  placeholder="예: 소개합니다!"
                />
                <AdminTextarea
                  label={labelWithStudio("소개 라인(줄바꿈)", studioAutofilled.intro)}
                  value={introLinesText}
                  onChange={setIntroLinesText}
                  placeholder="한 줄씩 입력"
                  rows={6}
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[12px] font-extrabold text-white/70">프로필 상태</div>
                <AdminInput
                  label={labelWithStudio("상태 타이틀", studioAutofilled.mood)}
                  value={moodTitle}
                  onChange={setMoodTitle}
                  placeholder="예: 요즘 어때?"
                />
                <AdminTextarea
                  label={labelWithStudio("상태 라인(줄바꿈)", studioAutofilled.mood)}
                  value={moodLinesText}
                  onChange={setMoodLinesText}
                  placeholder="한 줄씩 입력"
                  rows={4}
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[12px] font-extrabold text-white/70">카테고리 연결(홈 노출)</div>
                <div className="mt-3 space-y-2">
                  {categories.map((cat) => {
                    const checked = categoryIds.includes(cat.id);
                    return (
                      <label key={cat.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 py-3">
                        <div className="text-[12px] font-semibold text-white/70">{cat.title}</div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setCategoryIds((prev) => (on ? Array.from(new Set([...prev, cat.id])) : prev.filter((x) => x !== cat.id)));
                          }}
                          className="h-4 w-4 accent-[#ff4da7]"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <AdminTextarea
                label={labelWithStudio("메모(어드민 내부용)", studioAutofilled.notes)}
                value={notes}
                onChange={setNotes}
                placeholder="운영 메모"
                rows={4}
              />

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[12px] font-extrabold text-white/70">스파이시(성인 전용) 지원</div>
                <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-white/70">스파이시 지원 캐릭터로 표시</div>
                    <div className="mt-1 text-[11px] font-semibold text-white/35">
                      홈에서 스파이시 토글(ON) 시 이 캐릭터만 노출됩니다.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={safetySupported}
                    disabled={missingSafetySupportedColumn}
                    onChange={(e) => setSafetySupported(e.target.checked)}
                    className="h-4 w-4 accent-[#ff4da7]"
                  />
                </div>
                {missingSafetySupportedColumn ? (
                  <div className="mt-2 text-[11px] font-semibold text-[#ff9aa1]">
                    DB 컬럼이 없어서 비활성화돼요. `docs/panana-admin/MIGRATE_CHARACTER_SAFETY_SUPPORTED.sql` 실행 후 다시 시도해주세요.
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <AdminButton
                  onClick={async () => {
                    if (!selectedId) return;
                    setErr(null);
                    try {
                      const patch = {
                        slug: slug.trim(),
                        name: name.trim(),
                        tagline: tagline.trim(),
                        handle: handle.trim(),
                        hashtags: parseHashtags(hashtagsText),
                        mbti: mbti.trim(),
                        intro_title: introTitle.trim() || "소개합니다!",
                        intro_lines: splitLines(introLinesText),
                        mood_title: moodTitle.trim() || "요즘 어때?",
                        mood_lines: splitLines(moodLinesText),
                        followers_count: Number(followersCount) || 0,
                        following_count: Number(followingCount) || 0,
                        profile_image_url: profileImageUrl.trim(),
                        posts_count: Number(postsCount) || 0,
                        studio_character_id: studioCharacterId || null,
                        ...(missingSafetySupportedColumn ? {} : { safety_supported: Boolean(safetySupported) }),
                      };
                      const patchWithNotes = { ...patch, admin_notes: notes.trim() || null } as any;

                      let upErr: any = null;
                      // admin_notes 컬럼이 있으면 저장, 없으면 나머지만 저장 후 안내
                      if (!missingAdminNotesColumn) {
                        const res = await supabase.from("panana_characters").update(patchWithNotes).eq("id", selectedId);
                        upErr = res.error;
                        if (upErr) {
                          const msg = String(upErr?.message || "");
                          const code = String(upErr?.code || "");
                          const isMissing =
                            code === "42703" ||
                            msg.includes("admin_notes") ||
                            (msg.includes("column") && msg.includes("admin_notes") && msg.includes("does not exist"));
                          if (isMissing) {
                            setMissingAdminNotesColumn(true);
                            setErr(
                              "DB에 admin_notes 컬럼이 없어서 메모 저장을 건너뛰었어요. `docs/panana-admin/MIGRATE_CHARACTER_ADMIN_NOTES.sql` 실행 후 다시 저장하면 됩니다."
                            );
                            upErr = null;
                          }
                        }
                      }
                      if (missingAdminNotesColumn) {
                        const res = await supabase.from("panana_characters").update(patch as any).eq("id", selectedId);
                        upErr = res.error;
                      }
                      if (upErr) throw upErr;

                      // 카테고리 매핑: 전체 교체(단순/안전)
                      const { error: delErr } = await supabase.from("panana_character_categories").delete().eq("character_id", selectedId);
                      if (delErr) throw delErr;
                      if (categoryIds.length) {
                        const payload = categoryIds.map((cid, idx) => ({
                          character_id: selectedId,
                          category_id: cid,
                          sort_order: idx,
                          active: true,
                        }));
                        const { error: insErr } = await supabase.from("panana_character_categories").insert(payload as any);
                        if (insErr) throw insErr;
                      }

                      await load();
                      setSelectedId(selectedId);
                      triggerRevalidateForCurrent();
                    } catch (e: any) {
                      setErr(e?.message || "저장에 실패했어요.");
                    }
                  }}
                >
                  저장
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  onClick={async () => {
                    if (!selectedId) return;
                    setErr(null);
                    try {
                      const current = rows.find((r) => r.id === selectedId);
                      const { error } = await supabase.from("panana_characters").update({ active: !current?.active }).eq("id", selectedId);
                      if (error) throw error;
                      await load();
                      setSelectedId(selectedId);
                      triggerRevalidateForCurrent();
                    } catch (e: any) {
                      setErr(e?.message || "토글에 실패했어요.");
                    }
                  }}
                >
                  노출 토글
                </AdminButton>
                <AdminButton
                  variant="danger"
                  onClick={() => {
                    if (!selectedId) return;
                    setDeleteOpen(true);
                  }}
                >
                  삭제
                </AdminButton>
                <AdminButton variant="ghost" onClick={() => setEditOpen(false)}>
                  닫기
                </AdminButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      </div>
    </div>

      {/* 새 캐릭터 생성 (브라우저 prompt 대체) */}
      <StudioFormDialog
        open={createOpen}
        title="새 캐릭터 만들기"
        description={`슬러그는 자동으로 부여됩니다.\n(필요하면 생성 후 슬러그 필드에서 수정 가능)`}
        submitText="생성"
        cancelText="취소"
        busy={createBusy}
        fields={[
          {
            label: "캐릭터 이름(옵션)",
            value: createName,
            placeholder: "예: 차은경 (비우면 자동 생성)",
            helperText: `자동 슬러그: ${makeNewCharacterSlug()}`,
            autoFocus: true,
            onChange: setCreateName,
          },
        ]}
        onClose={() => {
          if (createBusy) return;
          setCreateOpen(false);
        }}
        onSubmit={async () => {
          const raw = createName.trim();
          // 이름은 옵션: 비우면 빈 문자열로 생성(Studio 연결 시 1회 자동 채움되도록)
          const nm = raw;
          setErr(null);
          setCreateBusy(true);
          try {
            const newSlug = makeNewCharacterSlug();
            const { data, error } = await supabase
              .from("panana_characters")
              .insert({
                slug: newSlug,
                name: nm,
                tagline: "",
                profile_image_url: "",
                posts_count: 0,
                active: false,
              })
              .select("id")
              .single();
            if (error) throw error;
            setCreateOpen(false);
            await load();
            if (data?.id) {
              setSelectedId(String(data.id));
              setEditOpen(true);
            }
          } catch (e: any) {
            setErr(e?.message || "생성에 실패했어요.");
          } finally {
            setCreateBusy(false);
          }
        }}
      />

      {/* 캐릭터 삭제 (브라우저 confirm 대체) */}
      <StudioConfirmDialog
        open={deleteOpen}
        title="정말 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요."
        destructive
        confirmText="삭제"
        cancelText="취소"
        busy={deleteBusy}
        onClose={() => {
          if (deleteBusy) return;
          setDeleteOpen(false);
        }}
        onConfirm={async () => {
          if (!selectedId) return;
          setErr(null);
          setDeleteBusy(true);
          try {
            const current = rows.find((r) => r.id === selectedId);
            const deletingSlug = current?.slug || slug;
            const deletingCategories = current?.categoryIds || categoryIds;
            const { error } = await supabase.from("panana_characters").delete().eq("id", selectedId);
            if (error) throw error;
            setDeleteOpen(false);
            setEditOpen(false);
            await load();
            setSelectedId(null);
            void triggerRevalidate([
              "/",
              "/home",
              deletingSlug ? `/c/${deletingSlug}` : "",
              ...getCategoryPaths(deletingCategories),
            ]);
          } catch (e: any) {
            setErr(e?.message || "삭제에 실패했어요.");
          } finally {
            setDeleteBusy(false);
          }
        }}
      />

      {/* 프로필 이미지 삭제 (브라우저 confirm 대체) */}
      <StudioConfirmDialog
        open={deleteImageOpen}
        title="프로필 이미지를 삭제할까요?"
        description="이미지를 삭제하면 기본 상태로 돌아갑니다."
        destructive
        confirmText="삭제"
        cancelText="취소"
        busy={deleteImageBusy}
        onClose={() => {
          if (deleteImageBusy) return;
          setDeleteImageOpen(false);
        }}
        onConfirm={async () => {
          if (!profileImageUrl) return;
          setErr(null);
          setDeleteImageBusy(true);
          try {
            await deleteCharacterProfileImageByUrl(profileImageUrl);
            setProfileImageUrl("");
            setDeleteImageOpen(false);
          } catch (e: any) {
            setErr(e?.message || "삭제에 실패했어요.");
          } finally {
            setDeleteImageBusy(false);
          }
        }}
      />

      {/* 프로필 이미지 크게보기 */}
      {imagePreviewOpen && profileImageUrl ? (
        <div
          className="fixed inset-0 z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setImagePreviewOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
          <div className="absolute inset-0 grid place-items-center px-6">
            <div className="relative w-full max-w-[920px] rounded-2xl border border-white/10 bg-[#0B0F18] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[13px] font-extrabold text-white/80">프로필 이미지</div>
                <AdminButton variant="ghost" onClick={() => setImagePreviewOpen(false)}>
                  닫기
                </AdminButton>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profileImageUrl} alt="" className="w-full max-h-[70vh] object-contain" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminAuthGate>
  );
}


