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
  ringtone_url?: string | null;
  hangup_sound_url?: string | null;
};

export default function AdminVoicePage() {
  const [config, setConfig] = useState<VoiceConfig>({
    voice_style_female: "warm",
    voice_style_male: "calm",
    voice_name_female: "Aoede",
    voice_name_male: "Fenrir",
    base_model: "gemini-2.5-flash-native-audio-preview-12-2025",
    ringtone_url: null,
    hangup_sound_url: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ringtoneUploading, setRingtoneUploading] = useState(false);
  const [ringtoneDrag, setRingtoneDrag] = useState(false);
  const [hangupUploading, setHangupUploading] = useState(false);
  const [hangupDrag, setHangupDrag] = useState(false);

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
            ringtone_url: c.ringtone_url ?? null,
            hangup_sound_url: c.hangup_sound_url ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveConfig = async (payload: VoiceConfig) => {
    const supabase = (await import("@/lib/supabase/browser")).getBrowserSupabase();
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (!token) throw new Error("로그인이 필요합니다.");
    const res = await fetch("/api/voice/config", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "저장 실패");
    return data;
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await saveConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleVoiceSfxFile = async (file: File, type: "ringtone" | "hangup") => {
    if (!file.type.startsWith("audio/") && file.type !== "audio/mpeg") {
      alert("MP3 등 오디오 파일만 등록할 수 있습니다.");
      return;
    }
    if (type === "ringtone") setRingtoneUploading(true);
    else setHangupUploading(true);
    try {
      const supabase = (await import("@/lib/supabase/browser")).getBrowserSupabase();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) {
        alert("로그인이 필요합니다.");
        return;
      }
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/voice/ringtone-upload?type=${type}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "업로드 실패");
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error("URL을 받지 못했습니다.");
      const next =
        type === "ringtone"
          ? { ...config, ringtone_url: publicUrl }
          : { ...config, hangup_sound_url: publicUrl };
      setConfig(next);
      await saveConfig(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "오디오 업로드 실패");
    } finally {
      if (type === "ringtone") setRingtoneUploading(false);
      else setHangupUploading(false);
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
          <h2 className="mb-2 font-semibold">전화 링 (벨소리)</h2>
          <p className="mb-4 text-sm text-white/50">
            음성 통화 연결 전 재생할 링톤 MP3를 드래그&amp;드롭하거나 클릭해 등록하세요.
          </p>
          <div
            className={`mb-4 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              ringtoneDrag ? "border-panana-pink/60 bg-panana-pink/10" : "border-white/20 bg-white/[0.02]"
            } ${ringtoneUploading ? "pointer-events-none opacity-60" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setRingtoneDrag(true);
            }}
            onDragLeave={() => setRingtoneDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setRingtoneDrag(false);
              const f = e.dataTransfer?.files?.[0];
              if (f) void handleVoiceSfxFile(f, "ringtone");
            }}
          >
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/*"
              className="hidden"
              id="ringtone-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleVoiceSfxFile(f, "ringtone");
                e.target.value = "";
              }}
            />
            <label htmlFor="ringtone-file" className="cursor-pointer">
              {ringtoneUploading ? (
                <span className="text-white/70">업로드 중...</span>
              ) : (
                <span className="text-white/70">
                  MP3 파일을 여기에 놓거나 <span className="text-panana-pink underline">클릭해서 선택</span>
                </span>
              )}
            </label>
          </div>
          {config.ringtone_url && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-sm text-white/80">등록됨: {config.ringtone_url}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const next = { ...config, ringtone_url: null };
                    setConfig(next);
                    try {
                      await saveConfig(next);
                      setSaved(true);
                      setTimeout(() => setSaved(false), 2500);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "제거 실패");
                    }
                  }}
                  className="shrink-0 text-sm text-red-400 hover:underline"
                >
                  제거
                </button>
              </div>
              <audio
                src={config.ringtone_url}
                controls
                className="h-9 w-full max-w-md accent-panana-pink [&::-webkit-media-controls-panel]:bg-white/5"
                preload="metadata"
              >
                브라우저가 오디오 재생을 지원하지 않습니다.
              </audio>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-2 font-semibold">전화 끊는 소리</h2>
          <p className="mb-4 text-sm text-white/50">
            통화 화면에서 끊기 아이콘을 누를 때 재생할 MP3를 등록하세요.
          </p>
          <div
            className={`mb-4 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              hangupDrag ? "border-panana-pink/60 bg-panana-pink/10" : "border-white/20 bg-white/[0.02]"
            } ${hangupUploading ? "pointer-events-none opacity-60" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setHangupDrag(true);
            }}
            onDragLeave={() => setHangupDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setHangupDrag(false);
              const f = e.dataTransfer?.files?.[0];
              if (f) void handleVoiceSfxFile(f, "hangup");
            }}
          >
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/*"
              className="hidden"
              id="hangup-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleVoiceSfxFile(f, "hangup");
                e.target.value = "";
              }}
            />
            <label htmlFor="hangup-file" className="cursor-pointer">
              {hangupUploading ? (
                <span className="text-white/70">업로드 중...</span>
              ) : (
                <span className="text-white/70">
                  MP3 파일을 여기에 놓거나 <span className="text-panana-pink underline">클릭해서 선택</span>
                </span>
              )}
            </label>
          </div>
          {config.hangup_sound_url && (
            <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-sm text-white/80">등록됨: {config.hangup_sound_url}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const next = { ...config, hangup_sound_url: null };
                    setConfig(next);
                    try {
                      await saveConfig(next);
                      setSaved(true);
                      setTimeout(() => setSaved(false), 2500);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "제거 실패");
                    }
                  }}
                  className="shrink-0 text-sm text-red-400 hover:underline"
                >
                  제거
                </button>
              </div>
              <audio
                src={config.hangup_sound_url}
                controls
                className="h-9 w-full max-w-md accent-panana-pink [&::-webkit-media-controls-panel]:bg-white/5"
                preload="metadata"
              >
                브라우저가 오디오 재생을 지원하지 않습니다.
              </audio>
            </div>
          )}
        </section>

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
