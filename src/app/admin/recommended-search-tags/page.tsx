"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminSectionHeader, AdminTextarea } from "../_components/AdminUI";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const DEFAULT_RECOMMENDED_TAGS = ["#현실연애", "#롤플주의", "#고백도전", "#연애감정", "#환승연애"];

function parseRecommendedTagsText(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

function formatRecommendedTagsForTextarea(tags: string[]): string {
  return tags.join("\n");
}

export default function AdminRecommendedSearchTagsPage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [recommendedSearchTagsText, setRecommendedSearchTagsText] = useState(
    () => formatRecommendedTagsForTextarea(DEFAULT_RECOMMENDED_TAGS)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from("panana_site_settings")
          .select("recommended_search_tags")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (err) throw err;
        const raw = data?.recommended_search_tags;
        if (Array.isArray(raw) && raw.length) {
          setRecommendedSearchTagsText(formatRecommendedTagsForTextarea(raw as string[]));
        }
      } catch (e: any) {
        if ((e?.message || "").includes("recommended_search_tags")) {
          setRecommendedSearchTagsText(formatRecommendedTagsForTextarea(DEFAULT_RECOMMENDED_TAGS));
        } else {
          setError(e?.message || "불러오기 실패");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  const save = async () => {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const tags = parseRecommendedTagsText(recommendedSearchTagsText);
      const payload = tags.length ? tags : DEFAULT_RECOMMENDED_TAGS;
      const { data: existing } = await supabase
        .from("panana_site_settings")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        const { error: err } = await supabase
          .from("panana_site_settings")
          .update({ recommended_search_tags: payload })
          .eq("id", existing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("panana_site_settings")
          .insert({ recommended_search_tags: payload });
        if (err) throw err;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e: any) {
      setError(e?.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="추천 검색어"
          subtitle="찾기 탭에서 표시되는 추천 검색어. 한 줄에 하나씩 입력, # 없이 써도 자동으로 붙습니다."
          right={
            <AdminButton onClick={save} disabled={saving || loading}>
              {saving ? "저장 중..." : "저장"}
            </AdminButton>
          }
        />

        {error ? (
          <div className="mb-4 rounded-xl border border-[#ff3d4a]/30 bg-[#ff3d4a]/10 px-4 py-3 text-[13px] font-semibold text-[#ff6b75]">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-4 rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-3 text-[13px] font-semibold text-[#6ee7b7]">
            저장되었습니다.
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <AdminTextarea
            label="추천 검색어 (한 줄에 하나)"
            value={recommendedSearchTagsText}
            onChange={setRecommendedSearchTagsText}
            rows={10}
            placeholder="#현실연애\n#롤플주의\n#고백도전"
          />
        </div>
      </div>
    </AdminAuthGate>
  );
}
