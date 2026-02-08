"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminInput, AdminSectionHeader, AdminTable, AdminTextarea } from "../_components/AdminUI";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type ChallengeRow = {
  id: string;
  character_id: string;
  title: string;
  challenge_goal: string;
  challenge_situation: string;
  success_keywords: string[];
  partial_match: boolean;
  gender: "female" | "male" | "both" | null;
  sort_order: number;
  active: boolean;
  character_slug?: string;
  character_name?: string;
  character_profile_image_url?: string;
  character_gender?: "female" | "male" | null;
};

type CharacterPick = { id: string; slug: string; name: string; profile_image_url: string; gender: "female" | "male" | null };

export default function AdminChallengesPage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [characters, setCharacters] = useState<CharacterPick[]>([]);
  const [selectedId, setSelectedId] = useState<string | null | "new">(null);
  const selected = useMemo(
    () => (selectedId === "new" ? null : rows.find((r) => r.id === selectedId) || null),
    [rows, selectedId],
  );
  const isCreateMode = selectedId === "new";
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [characterId, setCharacterId] = useState("");
  const [characterSearch, setCharacterSearch] = useState("");
  const [characterInputFocused, setCharacterInputFocused] = useState(false);
  const [genderFilter, setGenderFilter] = useState<"" | "male" | "female">("");
  const [title, setTitle] = useState("");
  const [challengeGoal, setChallengeGoal] = useState("");
  const [challengeSituation, setChallengeSituation] = useState("");
  const [successKeywordsText, setSuccessKeywordsText] = useState("");
  const [partialMatch, setPartialMatch] = useState(true);
  const [gender, setGender] = useState<"female" | "male" | "both" | "">("");
  const [sortOrder, setSortOrder] = useState("0");

  const load = async () => {
    setErr(null);
    setLoading(true);
    try {
      const [charRes, chalRes] = await Promise.all([
        supabase.from("panana_characters").select("id, slug, name, profile_image_url, gender").eq("active", true).order("name"),
        supabase
          .from("panana_challenges")
          .select("id, character_id, title, challenge_goal, challenge_situation, success_keywords, partial_match, gender, sort_order, active")
          .order("sort_order", { ascending: true }),
      ]);
      if (charRes.error) throw charRes.error;
      if (chalRes.error) throw chalRes.error;

      const charMap = new Map((charRes.data || []).map((c: any) => [c.id, c]));
      const list: ChallengeRow[] = (chalRes.data || []).map((r: any) => {
        const c = charMap.get(r.character_id);
        return {
          id: r.id,
          character_id: r.character_id,
          title: r.title || "",
          challenge_goal: r.challenge_goal || "",
          challenge_situation: r.challenge_situation || "",
          success_keywords: Array.isArray(r.success_keywords) ? r.success_keywords : [],
          partial_match: Boolean(r.partial_match),
          gender: r.gender || null,
          sort_order: Number(r.sort_order) || 0,
          active: Boolean(r.active),
          character_slug: c?.slug,
          character_name: c?.name,
          character_profile_image_url: c?.profile_image_url,
          character_gender: c?.gender === "female" || c?.gender === "male" ? c.gender : null,
        };
      });
      setRows(list);
      setCharacters(
        (charRes.data || []).map((c: any) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          profile_image_url: c.profile_image_url,
          gender: c.gender === "female" || c.gender === "male" ? c.gender : null,
        }))
      );
    } catch (e: any) {
      setErr(e?.message || "불러오기에 실패했어요. (MIGRATE_CHALLENGE_MODE.sql 실행 여부 확인)");
    } finally {
      setLoading(false);
    }
  };

  const prevSelectedIdRef = useRef<string | null | "new">(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const wasList = !prevSelectedIdRef.current;
    const isForm = selectedId === "new" || Boolean(selectedId);
    if (wasList && isForm) {
      window.history.pushState({ challengeForm: true }, "", window.location.href);
    }
    prevSelectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const onPopState = () => {
      if (selectedId === "new" || selectedId) setSelectedId(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [selectedId]);

  const filteredRows = useMemo(() => {
    if (!genderFilter) return rows;
    return rows.filter((r) => r.character_gender === genderFilter);
  }, [rows, genderFilter]);

  const filteredCharacters = useMemo(() => {
    const q = characterSearch.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.slug || "").toLowerCase().includes(q)
    );
  }, [characters, characterSearch]);

  const selectedCharacter = useMemo(
    () => characters.find((c) => c.id === characterId) || null,
    [characters, characterId],
  );

  useEffect(() => {
    if (selected) {
      setCharacterId(selected.character_id);
      setTitle(selected.title);
      setChallengeGoal(selected.challenge_goal);
      setChallengeSituation(selected.challenge_situation);
      setSuccessKeywordsText(selected.success_keywords.join(", "));
      setPartialMatch(selected.partial_match);
      setGender(selected.gender || "");
      setSortOrder(String(selected.sort_order));
    } else if (!isCreateMode) {
      setCharacterId("");
      setTitle("");
      setChallengeGoal("");
      setChallengeSituation("");
      setSuccessKeywordsText("");
      setPartialMatch(true);
      setGender("");
      setSortOrder("0");
    }
  }, [selected, isCreateMode]);

  const parseKeywords = (s: string) =>
    s
      .split(/[,;\n]/g)
      .map((x) => x.trim())
      .filter(Boolean);

  const save = async () => {
    if (!selectedId || selectedId === "new") return;
    setErr(null);
    try {
      const { error } = await supabase
        .from("panana_challenges")
        .update({
          character_id: characterId,
          title: title.trim(),
          challenge_goal: challengeGoal.trim(),
          challenge_situation: challengeSituation.trim(),
          success_keywords: parseKeywords(successKeywordsText),
          partial_match: partialMatch,
          gender: gender || null,
          sort_order: Number(sortOrder) || 0,
        })
        .eq("id", selectedId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setErr(e?.message || "저장에 실패했어요.");
    }
  };

  const create = async () => {
    if (!characterId) {
      setErr("캐릭터를 선택하세요.");
      return;
    }
    setErr(null);
    try {
      const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
      const { data, error } = await supabase
        .from("panana_challenges")
        .insert({
          character_id: characterId,
          title: title.trim() || "새 도전",
          challenge_goal: challengeGoal.trim(),
          challenge_situation: challengeSituation.trim(),
          success_keywords: parseKeywords(successKeywordsText),
          partial_match: partialMatch,
          gender: gender || null,
          sort_order: maxOrder + 1,
        })
        .select("id")
        .single();
      if (error) throw error;
      await load();
      if (data?.id) setSelectedId(data.id);
    } catch (e: any) {
      setErr(e?.message || "생성에 실패했어요.");
    }
  };

  const remove = async () => {
    if (!selectedId || selectedId === "new") return;
    setErr(null);
    try {
      const { error } = await supabase.from("panana_challenges").delete().eq("id", selectedId);
      if (error) throw error;
      setSelectedId(null);
      await load();
    } catch (e: any) {
      setErr(e?.message || "삭제에 실패했어요.");
    }
  };

  const toggleActive = async () => {
    if (!selectedId || selectedId === "new") return;
    const row = rows.find((r) => r.id === selectedId);
    if (!row) return;
    setErr(null);
    try {
      const { error } = await supabase
        .from("panana_challenges")
        .update({ active: !row.active })
        .eq("id", selectedId);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setErr(e?.message || "토글에 실패했어요.");
    }
  };

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="도전"
          subtitle="도전 모드 시나리오를 관리합니다. 캐릭터 선택, 목표, 성공 키워드(OR/부분 포함)를 설정하세요."
          right={
            <>
              <AdminButton variant="ghost" onClick={() => load()} disabled={loading}>
                새로고침
              </AdminButton>
              <AdminButton
                onClick={() => {
                  setSelectedId("new");
                  setCharacterId("");
                  setTitle("");
                  setChallengeGoal("");
                  setChallengeSituation("");
                  setSuccessKeywordsText("");
                  setPartialMatch(true);
                  setGender("");
                  setSortOrder(String(rows.length));
                }}
              >
                + 새 도전
              </AdminButton>
            </>
          }
        />

        {err ? <div className="mb-4 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
        {loading ? <div className="mb-4 text-[12px] font-semibold text-white/45">불러오는 중...</div> : null}

        <div>
          {!selected && !isCreateMode ? (
            <>
              <div className="mb-3 flex gap-1">
                <button
                  type="button"
                  onClick={() => setGenderFilter("")}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-extrabold transition ${
                    !genderFilter ? "bg-panana-pink/30 text-panana-pink ring-1 ring-panana-pink/50" : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => setGenderFilter("male")}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-extrabold transition ${
                    genderFilter === "male" ? "bg-panana-pink/30 text-panana-pink ring-1 ring-panana-pink/50" : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  남성
                </button>
                <button
                  type="button"
                  onClick={() => setGenderFilter("female")}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-extrabold transition ${
                    genderFilter === "female" ? "bg-panana-pink/30 text-panana-pink ring-1 ring-panana-pink/50" : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  여성
                </button>
              </div>
              <AdminTable
                columns={[
                  { key: "title", header: "제목" },
                  { key: "character", header: "캐릭터" },
                  { key: "gender", header: "성별" },
                  { key: "keywords", header: "성공 키워드" },
                  { key: "active", header: "노출" },
                  { key: "actions", header: "선택" },
                ]}
                rows={filteredRows.map((r) => ({
                  title: r.title,
                  character: <span className="text-white/55">{r.character_name || r.character_slug || "-"}</span>,
                  gender: <span className="text-white/55">{r.gender || "both"}</span>,
                  keywords: (
                    <span className="text-[11px] text-white/45">
                      {(r.success_keywords || []).slice(0, 3).join(", ")}
                      {(r.success_keywords || []).length > 3 ? " …" : ""}
                    </span>
                  ),
                  active: r.active ? (
                    <span className="rounded-full bg-[#22c55e]/15 px-2 py-1 text-[11px] font-extrabold text-[#6ee7b7]">ON</span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-extrabold text-white/45">OFF</span>
                  ),
                  actions: (
                    <AdminButton variant="ghost" onClick={() => setSelectedId(r.id)}>
                      편집
                    </AdminButton>
                  ),
                }))}
              />
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 max-w-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[14px] font-extrabold text-white/80">{isCreateMode ? "새 도전 추가" : "편집"}</div>
                <AdminButton variant="ghost" onClick={() => setSelectedId(null)}>
                  목록으로
                </AdminButton>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-[12px] font-bold text-white/55">캐릭터</div>
                  <input
                    type="text"
                    value={
                      characterInputFocused || characterSearch
                        ? characterSearch
                        : selectedCharacter
                          ? `${selectedCharacter.name} (${selectedCharacter.slug})`
                          : ""
                    }
                    onChange={(e) => setCharacterSearch(e.target.value)}
                    onFocus={() => {
                      setCharacterInputFocused(true);
                      setCharacterSearch("");
                    }}
                    onBlur={() => setTimeout(() => setCharacterInputFocused(false), 150)}
                    placeholder="캐릭터 검색 (이름, 슬러그)"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[13px] font-semibold text-white/80 placeholder:text-white/35 outline-none focus:border-panana-pink/40"
                  />
                  <div className="mt-2 max-h-[200px] overflow-y-auto rounded-xl border border-white/10 bg-black/25">
                    {(characterSearch ? filteredCharacters : characters).slice(0, 30).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCharacterId(c.id);
                          setCharacterSearch("");
                        }}
                        className={`block w-full px-4 py-2.5 text-left text-[13px] font-semibold transition hover:bg-white/10 ${
                          characterId === c.id ? "bg-panana-pink/20 text-panana-pink" : "text-white/80"
                        }`}
                      >
                        {c.name} ({c.slug}){c.gender ? ` · ${c.gender === "male" ? "남" : "여"}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
                <AdminInput label="제목" value={title} onChange={setTitle} placeholder="예: 여사친 김하니에게 고백하기" />
                <AdminInput
                  label="도전 목표"
                  value={challengeGoal}
                  onChange={setChallengeGoal}
                  placeholder="예: 여사친 김하니에게 고백 성공하기!"
                />
                <AdminTextarea
                  label="도전 상황"
                  value={challengeSituation}
                  onChange={setChallengeSituation}
                  placeholder="시나리오 설명"
                  rows={4}
                />
                <AdminInput
                  label="성공 키워드 (쉼표 구분, OR)"
                  value={successKeywordsText}
                  onChange={setSuccessKeywordsText}
                  placeholder="예: 사귀자, 사랑해, 받아줄게"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={partialMatch}
                    onChange={(e) => setPartialMatch(e.target.checked)}
                    className="h-4 w-4 accent-[#ff4da7]"
                  />
                  <span className="text-[12px] font-semibold text-white/70">부분 포함 시 성공 (변형 허용)</span>
                </label>
                <div>
                  <div className="text-[12px] font-bold text-white/55">성별</div>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "female" | "male" | "both" | "")}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[13px] font-semibold text-white/80 outline-none"
                  >
                    <option value="">both (혼합)</option>
                    <option value="female">여성 전용</option>
                    <option value="male">남성 전용</option>
                    <option value="both">both</option>
                  </select>
                </div>
                <AdminInput label="정렬" value={sortOrder} onChange={setSortOrder} placeholder="0" />
                <div className="flex flex-wrap gap-2">
                  {isCreateMode ? (
                    <AdminButton onClick={create}>생성</AdminButton>
                  ) : (
                    <>
                      <AdminButton onClick={save}>저장</AdminButton>
                      <AdminButton variant="ghost" onClick={toggleActive}>
                        노출 토글
                      </AdminButton>
                      <AdminButton variant="danger" onClick={remove}>
                        삭제
                      </AdminButton>
                    </>
                  )}
                  {isCreateMode ? (
                    <AdminButton variant="ghost" onClick={() => setSelectedId(null)}>
                      취소
                    </AdminButton>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminAuthGate>
  );
}
