"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";

const VOICE_STYLES = [
  { value: "calm", label: "차분하게" },
  { value: "bright", label: "밝게" },
  { value: "firm", label: "단호하게" },
  { value: "empathetic", label: "공감적으로" },
  { value: "warm", label: "다정하게" },
];

const VOICE_NAMES = [
  { value: "Aoede", label: "Aoede (여성향)" },
  { value: "Charon", label: "Charon (여성향)" },
  { value: "Fenrir", label: "Fenrir (남성향)" },
  { value: "Kore", label: "Kore (여성향)" },
  { value: "Puck", label: "Puck (남성향)" },
];

type VoiceConfig = {
  voice_style_female: string;
  voice_style_male: string;
  voice_name_female: string;
  voice_name_male: string;
  base_model?: string;
};

export default function AdminVoicePage() {
  const [config, setConfig] = useState<VoiceConfig>({
    voice_style_female: "warm",
    voice_style_male: "calm",
    voice_name_female: "Aoede",
    voice_name_male: "Fenrir",
    base_model: "gemini-2.5-flash-native-audio-preview-12-2025",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/voice/config")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d?.data) {
          const c = d.data;
          setConfig({
            voice_style_female: c.voice_style_female || c.voice_style || "warm",
            voice_style_male: c.voice_style_male || c.voice_style || "calm",
            voice_name_female: c.voice_name_female || "Aoede",
            voice_name_male: c.voice_name_male || "Fenrir",
            base_model: c.base_model || "gemini-2.5-flash-native-audio-preview-12-2025",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const supabase = (await import("@/lib/supabase/browser")).getBrowserSupabase();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) {
        alert("로그인이 필요합니다.");
        return;
      }
      const res = await fetch("/api/voice/config", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "저장 실패");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-white/60">
        로딩 중...
      </div>
    );
  }

  return (
    <AdminAuthGate>
    <div className="text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/admin" className="mb-4 inline-block text-sm text-panana-pink hover:underline">
          ← 관리자 리스트
        </Link>
        <h1 className="text-2xl font-bold">음성 설정</h1>
        <p className="mt-1 text-sm text-white/50">
          캐릭터 음성 대화 시 사용할 성별·말투·보이스 이름을 설정합니다.
        </p>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-2 font-semibold">음성대화 설정</h2>
          <p className="mb-4 text-sm text-white/50">
            캐릭터의 성별 속성에 따라 여성/남성 설정이 각각 적용됩니다.
          </p>
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="mb-3 text-sm font-medium text-panana-pink/90">여성 캐릭터</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-white/60 mb-1">말투/성향</label>
                  <select
                    value={config.voice_style_female}
                    onChange={(e) => setConfig((c) => ({ ...c, voice_style_female: e.target.value }))}
                    className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white"
                  >
                    {VOICE_STYLES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">보이스 이름</label>
                  <select
                    value={config.voice_name_female}
                    onChange={(e) => setConfig((c) => ({ ...c, voice_name_female: e.target.value }))}
                    className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white"
                  >
                    {VOICE_NAMES.filter((v) => ["Aoede", "Kore", "Charon"].includes(v.value)).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="mb-3 text-sm font-medium text-panana-pink/90">남성 캐릭터</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-white/60 mb-1">말투/성향</label>
                  <select
                    value={config.voice_style_male}
                    onChange={(e) => setConfig((c) => ({ ...c, voice_style_male: e.target.value }))}
                    className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white"
                  >
                    {VOICE_STYLES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">보이스 이름</label>
                  <select
                    value={config.voice_name_male}
                    onChange={(e) => setConfig((c) => ({ ...c, voice_name_male: e.target.value }))}
                    className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white"
                  >
                    {VOICE_NAMES.filter((v) => ["Fenrir", "Puck"].includes(v.value)).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Gemini Live 모델 (공통)</label>
              <input
                type="text"
                value={config.base_model || ""}
                onChange={(e) => setConfig((c) => ({ ...c, base_model: e.target.value }))}
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-white"
                placeholder="gemini-2.5-flash-native-audio-preview-12-2025"
              />
            </div>
          </div>
        </section>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-panana-pink px-6 py-3 font-semibold text-[#0B0C10] hover:bg-panana-pink/90 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>

        {saved && (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-xl bg-emerald-600 px-6 py-3 text-white font-medium shadow-lg">
            저장되었습니다.
          </div>
        )}
      </div>
    </div>
    </AdminAuthGate>
  );
}
