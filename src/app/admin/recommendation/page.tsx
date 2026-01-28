"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminInput, AdminSectionHeader } from "../_components/AdminUI";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  defaultRecommendationSettings,
  mergeRecommendationSettings,
  type PreferenceMappingGroup,
  type RecommendationSettings,
} from "@/lib/pananaApp/recommendation";

type MappingKey = "purpose" | "mood" | "characterType";

const labels: Record<MappingKey, Record<string, string>> = {
  purpose: {
    spark: "설레는 대화하기",
    comfort: "편하게 위로받기",
    spicy: "자극적인 대화 나누기",
    real: "현실적인 느낌 나누기",
    light: "가볍게 즐기기",
  },
  mood: {
    sweet: "달달한",
    calm: "차분한",
    playful: "장난스러운",
    tense: "긴장감 있는",
    intense: "강렬한",
  },
  characterType: {
    gentle: "다정한 타입",
    care: "무심한 듯 챙겨주는 타입",
    confident: "자신감 넘치는 타입",
    mystery: "비밀 많은 타입",
    cute: "귀여운 타입",
  },
};

function toTagArray(value: string) {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

function toTagString(tags: string[]) {
  return (tags || []).join(", ");
}

export default function AdminRecommendationPage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [settings, setSettings] = useState<RecommendationSettings>(defaultRecommendationSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("panana_site_settings")
        .select("recommendation_settings")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data?.recommendation_settings) {
        setSettings(mergeRecommendationSettings(data.recommendation_settings as any));
      } else {
        setSettings(defaultRecommendationSettings);
      }
    } catch (e: any) {
      setErr(e?.message || "불러오기에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    setErr(null);
    setSuccess(false);
    try {
      const { data: existing } = await supabase
        .from("panana_site_settings")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("panana_site_settings")
          .update({ recommendation_settings: settings })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("panana_site_settings")
          .insert({ recommendation_settings: settings });
        if (error) throw error;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e: any) {
      setErr(e?.message || "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const updateMapping = (group: MappingKey, key: string, patch: Partial<{ weight: number; tags: string[] }>) => {
    setSettings((prev) => {
      const cur = prev.mapping[group] as PreferenceMappingGroup;
      return {
        ...prev,
        mapping: {
          ...prev.mapping,
          [group]: {
            ...cur,
            [key]: {
              weight: patch.weight ?? cur[key]?.weight ?? 1,
              tags: patch.tags ?? cur[key]?.tags ?? [],
            },
          },
        },
      };
    });
  };

  const updateBehaviorWeight = (key: keyof RecommendationSettings["behaviorWeights"], value: string) => {
    const num = Number(value);
    setSettings((prev) => ({
      ...prev,
      behaviorWeights: { ...prev.behaviorWeights, [key]: Number.isFinite(num) ? num : 0 },
    }));
  };

  const updatePopularNumber = (key: keyof RecommendationSettings["popular"], value: string, min?: number, max?: number) => {
    const num = Number(value);
    const safe = Number.isFinite(num) ? num : 0;
    const clamped = max != null ? Math.min(max, safe) : safe;
    const final = min != null ? Math.max(min, clamped) : clamped;
    setSettings((prev) => ({
      ...prev,
      popular: { ...prev.popular, [key]: final },
    }));
  };

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="추천(개인화) 설정"
          subtitle="입국심사 답변 태그 매핑, 행동 가중치, 캐시 및 A/B를 관리합니다."
          right={
            <div className="flex items-center gap-2">
              <AdminButton variant="ghost" onClick={() => load()} disabled={loading}>
                새로고침
              </AdminButton>
              <AdminButton onClick={() => save()} disabled={saving || loading}>
                {saving ? "저장 중..." : "저장"}
              </AdminButton>
            </div>
          }
        />

        {err ? (
          <div className="mb-4 rounded-xl border border-[#ff3d4a]/30 bg-[#ff3d4a]/10 px-4 py-3 text-[13px] font-semibold text-[#ff6b75]">
            {err}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-3 text-[13px] font-semibold text-[#6ee7b7]">
            저장되었습니다.
          </div>
        ) : null}

        {(["purpose", "mood", "characterType"] as MappingKey[]).map((group) => (
          <div key={group} className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="mb-4 text-[13px] font-extrabold text-white/80">
              {group === "purpose" ? "Step.1 목적" : group === "mood" ? "Step.2 분위기" : "Step.3 타입"}
            </div>
            <div className="space-y-3">
              {Object.keys(labels[group]).map((key) => {
                const row = settings.mapping[group][key];
                return (
                  <div key={key} className="grid grid-cols-[180px_120px_1fr] gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12px] font-semibold text-white/80">
                      {labels[group][key]}
                    </div>
                    <AdminInput
                      label="가중치"
                      value={String(row?.weight ?? 1)}
                      onChange={(v) => updateMapping(group, key, { weight: Number(v) || 0 })}
                      placeholder="예: 1.5"
                    />
                    <AdminInput
                      label="태그 (쉼표로 구분)"
                      value={toTagString(row?.tags || [])}
                      onChange={(v) => updateMapping(group, key, { tags: toTagArray(v) })}
                      placeholder="예: #설렘, #로맨스, #두근"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="mb-4 text-[13px] font-extrabold text-white/80">행동 로그 가중치</div>
          <div className="grid gap-3 md:grid-cols-3">
            <AdminInput
              label="클릭"
              value={String(settings.behaviorWeights.click)}
              onChange={(v) => updateBehaviorWeight("click", v)}
              placeholder="예: 0.6"
            />
            <AdminInput
              label="채팅 시작"
              value={String(settings.behaviorWeights.chatStart)}
              onChange={(v) => updateBehaviorWeight("chatStart", v)}
              placeholder="예: 1.4"
            />
            <AdminInput
              label="즐겨찾기"
              value={String(settings.behaviorWeights.favorite)}
              onChange={(v) => updateBehaviorWeight("favorite", v)}
              placeholder="예: 2.2"
            />
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="mb-4 text-[13px] font-extrabold text-white/80">캐시 & A/B</div>
          <div className="grid gap-3 md:grid-cols-3">
            <AdminInput
              label="캐시 TTL (초)"
              value={String(settings.cacheTtlSec)}
              onChange={(v) => setSettings((prev) => ({ ...prev, cacheTtlSec: Math.max(60, Number(v) || 0) }))}
              placeholder="예: 3600"
            />
            <AdminInput
              label="A/B 비율 (B)"
              value={String(settings.ab.ratioB)}
              onChange={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  ab: { ...prev.ab, ratioB: Math.min(1, Math.max(0, Number(v) || 0)) },
                }))
              }
              placeholder="예: 0.5"
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, ab: { ...prev.ab, enabled: !prev.ab.enabled } }))}
                className={`h-10 w-28 rounded-full border border-white/10 px-3 text-[12px] font-extrabold ${
                  settings.ab.enabled ? "bg-[#ff4da7] text-white" : "bg-white/[0.05] text-white/70"
                }`}
              >
                {settings.ab.enabled ? "A/B ON" : "A/B OFF"}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="mb-4 text-[13px] font-extrabold text-white/80">인기 점수(모두에게 사랑받는)</div>
          <div className="grid gap-3 md:grid-cols-3">
            <AdminInput
              label="집계 기간(일)"
              value={String(settings.popular.days)}
              onChange={(v) => updatePopularNumber("days", v, 7, 120)}
              placeholder="예: 30"
            />
            <AdminInput
              label="최근 기간(일)"
              value={String(settings.popular.recentDays)}
              onChange={(v) => updatePopularNumber("recentDays", v, 1, 30)}
              placeholder="예: 7"
            />
            <AdminInput
              label="캐시 TTL (초)"
              value={String(settings.popular.cacheTtlSec)}
              onChange={(v) => updatePopularNumber("cacheTtlSec", v, 60)}
              placeholder="예: 600"
            />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <AdminInput
              label="메시지 가중치"
              value={String(settings.popular.msgWeight)}
              onChange={(v) => updatePopularNumber("msgWeight", v)}
              placeholder="예: 0.4"
            />
            <AdminInput
              label="최근 메시지 가중치"
              value={String(settings.popular.recentWeight)}
              onChange={(v) => updatePopularNumber("recentWeight", v)}
              placeholder="예: 0.8"
            />
            <AdminInput
              label="유니크 유저 가중치"
              value={String(settings.popular.userWeight)}
              onChange={(v) => updatePopularNumber("userWeight", v)}
              placeholder="예: 2.0"
            />
            <AdminInput
              label="최근성 보정 가중치"
              value={String(settings.popular.recencyWeight)}
              onChange={(v) => updatePopularNumber("recencyWeight", v)}
              placeholder="예: 1.0"
            />
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}
