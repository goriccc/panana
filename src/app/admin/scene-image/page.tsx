"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminSectionHeader } from "../_components/AdminUI";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export default function AdminSceneImagePage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [sceneImageEnabled, setSceneImageEnabled] = useState(true);
  const [sceneImageDailyLimit, setSceneImageDailyLimit] = useState(5);
  const [sceneImageSteps, setSceneImageSteps] = useState(20);
  const [visionCacheMinutes, setVisionCacheMinutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data, error } = await supabase
          .from("panana_site_settings")
          .select("scene_image_enabled, scene_image_daily_limit, scene_image_model, scene_image_steps, scene_image_vision_cache_minutes")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          if (data.scene_image_enabled !== undefined) setSceneImageEnabled(!!data.scene_image_enabled);
          if (data.scene_image_daily_limit != null)
            setSceneImageDailyLimit(Math.max(1, Math.min(100, Number(data.scene_image_daily_limit) || 5)));
          const rawSteps = (data as any)?.scene_image_steps;
          const st =
            rawSteps != null
              ? Math.max(8, Math.min(20, Number(rawSteps) || 20))
              : (data as any)?.scene_image_model === "schnell"
                ? 8
                : 20;
          setSceneImageSteps(st);
          const vcm = Number((data as any)?.scene_image_vision_cache_minutes ?? 60);
          setVisionCacheMinutes(Math.max(0, Math.min(10080, vcm || 60)));
        }
      } catch (e: any) {
        setErr(e?.message || "불러오기에 실패했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

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
      const limit = Math.max(1, Math.min(100, Number(sceneImageDailyLimit) || 5));
      const vcm = Math.max(0, Math.min(10080, Number(visionCacheMinutes) || 60));
      const steps = Math.max(8, Math.min(20, Number(sceneImageSteps) || 20));
      if (existing?.id) {
        const { error } = await supabase
          .from("panana_site_settings")
          .update({
            scene_image_enabled: sceneImageEnabled,
            scene_image_daily_limit: limit,
            scene_image_steps: steps,
            scene_image_vision_cache_minutes: vcm,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("panana_site_settings")
          .insert({
            scene_image_enabled: sceneImageEnabled,
            scene_image_daily_limit: limit,
            scene_image_steps: steps,
            scene_image_vision_cache_minutes: vcm,
          } as any);
        if (error) throw error;
      }
      setSceneImageDailyLimit(limit);
      setSceneImageSteps(steps);
      setVisionCacheMinutes(vcm);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e: any) {
      setErr(e?.message || "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="장면 이미지 (PuLID/Flux)"
          subtitle="채팅 중 자동 생성되는 장면 이미지의 기능 ON/OFF 및 무료 일일 쿼터를 관리합니다."
          right={
            <div className="flex items-center gap-2">
              <AdminButton variant="ghost" onClick={() => window.location.reload()} disabled={loading}>
                새로고침
              </AdminButton>
              <AdminButton onClick={save} disabled={saving || loading}>
                {saving ? "저장 중..." : success ? "저장됨!" : "저장"}
              </AdminButton>
            </div>
          }
        />

        {err ? (
          <div className="mb-4 rounded-xl border border-[#ff3d4a]/30 bg-[#ff3d4a]/10 px-4 py-3 text-[13px] font-semibold text-[#ff6b75]">
            {err}
          </div>
        ) : null}

        <div className="max-w-[480px] space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-extrabold text-white/80">기능 활성화</div>
                <div className="mt-1 text-[11px] font-semibold text-white/40">
                  장면 이미지 자동 생성(채팅 중 PuLID/Flux)을 켜거나 끕니다.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSceneImageEnabled((v) => !v)}
                className={`h-9 w-16 rounded-full border border-white/10 p-1 ${
                  sceneImageEnabled ? "bg-[#ff4da7]" : "bg-white/[0.06]"
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-full bg-white transition-transform ${
                    sceneImageEnabled ? "translate-x-7" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="text-[13px] font-extrabold text-white/80">Flux PuLID 스텝</div>
            <div className="mt-4 space-y-3">
              <div className="relative flex items-center gap-3">
                <span className="text-[12px] font-bold text-white/45">8</span>
                <input
                  type="range"
                  min={8}
                  max={20}
                  step={1}
                  value={sceneImageSteps}
                  onChange={(e) => setSceneImageSteps(Math.max(8, Math.min(20, Number(e.target.value) || 20)))}
                  disabled={loading}
                  className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-panana-pink disabled:opacity-50 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-panana-pink [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-panana-pink"
                />
                <span className="text-[12px] font-bold text-white/45">20</span>
              </div>
              <div className="text-center text-[12px] font-bold text-white/70">현재: {sceneImageSteps} step</div>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="font-bold text-white/70">속도 타협 (8 Steps)</div>
                  <div className="mt-1 text-white/50">생성: 1.5~2.0초 · 약 20~30원</div>
                  <div className="mt-1 text-amber-400/80">주의: 거칠거나 노이즈, 배경 디테일 뭉개짐 가능</div>
                </div>
                <div className="rounded-xl border border-panana-pink/30 bg-panana-pink/5 p-3">
                  <div className="font-bold text-white/90">표준 설정 (20 Steps) · 추천</div>
                  <div className="mt-1 text-white/60">생성: 3.5~4.5초 · 약 50~65원</div>
                  <div className="mt-1 text-white/50">피부 매끄럽고 이목구비 뚜렷한 고화질 실사</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="text-[13px] font-extrabold text-white/80">무료 일일 쿼터 (회/일)</div>
            <div className="mt-1 text-[11px] font-semibold text-white/40">
              유저당 하루 무료 장면 이미지 생성 횟수 (1~100)
            </div>
            <input
              type="number"
              min={1}
              max={100}
              value={sceneImageDailyLimit}
              onChange={(e) => setSceneImageDailyLimit(Math.max(1, Math.min(100, Number(e.target.value) || 5)))}
              disabled={loading}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] font-semibold text-white/85 outline-none disabled:opacity-50"
            />
            <div className="mt-2 text-[12px] font-semibold text-white/45">
              현재: {sceneImageDailyLimit}회/일
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="text-[13px] font-extrabold text-white/80">Vision 캐시 시간 (분)</div>
            <div className="mt-1 text-[11px] font-semibold text-white/40">
              썸네일 의상·헤어 추출(Vision LLM) 결과 캐시 유지 시간. 0=캐시 끔.
            </div>
            <input
              type="number"
              min={0}
              max={10080}
              value={visionCacheMinutes}
              onChange={(e) =>
                setVisionCacheMinutes(Math.max(0, Math.min(10080, Number(e.target.value) || 0)))
              }
              disabled={loading}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[14px] font-semibold text-white/85 outline-none disabled:opacity-50"
            />
            <div className="mt-2 text-[12px] font-semibold text-white/45">
              현재: {visionCacheMinutes}분
              {visionCacheMinutes >= 60 ? ` (${Math.floor(visionCacheMinutes / 60)}시간)` : ""}
            </div>
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}
