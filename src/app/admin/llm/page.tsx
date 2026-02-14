"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminInput, AdminSectionHeader } from "../_components/AdminUI";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const PROVIDERS = [
  { key: "anthropic", label: "Claude (Anthropic)" },
  { key: "gemini", label: "Gemini" },
] as const;

type LlmSettingRow = {
  id: string;
  scope: string;
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  force_parenthesis: boolean;
  nsfw_filter: boolean;
};

export default function AdminLlmSettingsPage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [rows, setRows] = useState<LlmSettingRow[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<"anthropic" | "gemini">("anthropic");
  const selected = rows.find((r) => r.scope === "global" && r.provider === selectedProvider) || null;

  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [forceParenthesis, setForceParenthesis] = useState(false);
  const [nsfwFilter, setNsfwFilter] = useState(true);

  const [defaultProvider, setDefaultProvider] = useState<"anthropic" | "gemini">("anthropic");
  const [fallbackProvider, setFallbackProvider] = useState<"anthropic" | "gemini">("gemini");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [llmRes, siteRes] = await Promise.all([
        supabase
          .from("panana_llm_settings")
          .select("id, scope, provider, model, temperature, max_tokens, top_p, force_parenthesis, nsfw_filter")
          .eq("scope", "global")
          .order("provider", { ascending: true }),
        supabase.from("panana_site_settings").select("id, llm_default_provider, llm_fallback_provider").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (llmRes.error) throw llmRes.error;
      setRows((llmRes.data || []) as any);
      const site = siteRes.data;
      if (site) {
        const d = (site as any).llm_default_provider;
        const f = (site as any).llm_fallback_provider;
        if (d === "anthropic" || d === "gemini") setDefaultProvider(d);
        if (f === "anthropic" || f === "gemini") setFallbackProvider(f);
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

  useEffect(() => {
    setModel(selected?.model || "");
    setTemperature(typeof selected?.temperature === "number" ? selected.temperature : 0.7);
    setTopP(typeof selected?.top_p === "number" ? selected.top_p : 1.0);
    setMaxTokens(typeof selected?.max_tokens === "number" ? selected.max_tokens : 1024);
    setForceParenthesis(Boolean(selected?.force_parenthesis));
    setNsfwFilter(Boolean(selected?.nsfw_filter ?? true));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProvider = async () => {
    setErr(null);
    try {
      const patch = {
        model: model.trim(),
        temperature: Number.isFinite(temperature) ? temperature : 0,
        top_p: Number.isFinite(topP) ? topP : 0,
        max_tokens: Number.isFinite(maxTokens) ? maxTokens : 0,
        force_parenthesis: forceParenthesis,
        nsfw_filter: nsfwFilter,
      };

      if (selected?.id) {
        const { error } = await supabase.from("panana_llm_settings").update(patch).eq("id", selected.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("panana_llm_settings")
          .insert({ scope: "global", provider: selectedProvider, ...patch });
        if (error) throw error;
      }

      await load();
    } catch (e: any) {
      setErr(e?.message || "저장에 실패했어요.");
    }
  };

  const saveDefaultFallback = async () => {
    setErr(null);
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
          .update({
            llm_default_provider: defaultProvider,
            llm_fallback_provider: fallbackProvider,
          })
          .eq("id", existing.id);
        if (error) throw error;
      }
      await load();
    } catch (e: any) {
      setErr(e?.message || "저장에 실패했어요.");
    }
  };

  const modelPlaceholder =
    selectedProvider === "anthropic"
      ? "예: auto, claude-haiku-4-5, claude-sonnet-4-5"
      : "예: auto, gemini-2.5-flash, gemini-2.5-pro";

  const MODEL_NAMES_COPY: Record<string, string[]> = {
    anthropic: ["auto", "claude-haiku-4-5", "claude-sonnet-4-5"],
    gemini: ["auto", "gemini-2.5-flash", "gemini-2.5-pro"],
  };

  const MODEL_LABELS: Record<string, Record<string, string>> = {
    anthropic: { auto: "자동 (Haiku/Sonnet)" },
    gemini: { auto: "자동 (Flash/Pro)" },
  };

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="LLM 설정"
          subtitle="API Key는 Vercel 환경변수로만 관리합니다. 기본 대화/성인 폴백과 프로바이더별 model·temperature 등을 설정합니다."
          right={
            <div className="flex items-center gap-2">
              <AdminButton variant="ghost" onClick={() => load()}>
                새로고침
              </AdminButton>
            </div>
          }
        />

        {err ? <div className="mb-4 text-[12px] font-semibold text-[#ff9aa1]">{err}</div> : null}
        {loading ? <div className="mb-4 text-[12px] font-semibold text-white/45">불러오는 중...</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 기본/성인 폴백 */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[13px] font-extrabold text-white/80">기본 대화 / 성인 수위 폴백</div>
          <div className="mt-2 text-[11px] font-semibold text-white/35">
            기본은 Claude로 대화하고, 스파이시(19금) 수위일 때 클로드 자체검열을 피하기 위해 폴백 모델로 전환합니다.
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <div className="text-[12px] font-bold text-white/55">기본 프로바이더 (일반 대화)</div>
              <select
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-semibold text-white/90"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[12px] font-bold text-white/55">성인 수위 시 폴백 프로바이더</div>
              <select
                value={fallbackProvider}
                onChange={(e) => setFallbackProvider(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-semibold text-white/90"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-white/50">
              폴백 시 Gemini는 문장·맥락에 따라 Flash(짧거나 단순) 또는 Pro(그 외)가 자동 선택됩니다.
            </div>
            <AdminButton onClick={saveDefaultFallback}>기본/폴백 저장</AdminButton>
          </div>
        </div>

        {/* 프로바이더별 설정 */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelectedProvider(p.key)}
                className={`rounded-xl px-4 py-2 text-[12px] font-bold transition ${
                  selectedProvider === p.key ? "bg-panana-pink text-[#0B0C10]" : "bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-[12px] font-bold text-white/55">Model</div>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={modelPlaceholder}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white/90 placeholder:text-white/40"
              />
              <div className="mt-2 text-[11px] font-semibold text-white/35">
                {selectedProvider === "anthropic"
                  ? "선택하면 모델 필드에 반영됩니다. 자동은 짧/단순→Haiku, 그 외→Sonnet."
                  : selectedProvider === "gemini"
                    ? "선택하면 모델 필드에 반영됩니다. 미선택 시 대화 복잡도에 따라 Flash/Pro가 자동 선택됩니다."
                    : "선택하면 모델 필드에 반영됩니다."}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(MODEL_NAMES_COPY[selectedProvider] || []).map((name) => (
                  <label
                    key={name}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 font-mono text-[11px] transition ${
                      model === name ? "border-panana-pink bg-panana-pink/15 text-white" : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="model-choice"
                      checked={model === name}
                      onChange={() => setModel(name)}
                      className="sr-only"
                    />
                    {MODEL_LABELS[selectedProvider]?.[name] ?? name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[12px] font-bold text-white/55">Temperature</div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="flex-1 accent-[#ff4da7]"
                />
                <div className="w-[64px] rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[12px] font-extrabold text-white/80">
                  {temperature.toFixed(2)}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[12px] font-bold text-white/55">Top P</div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={topP}
                  onChange={(e) => setTopP(Number(e.target.value))}
                  className="flex-1 accent-[#ff4da7]"
                />
                <div className="w-[64px] rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[12px] font-extrabold text-white/80">
                  {topP.toFixed(2)}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[12px] font-bold text-white/55">Max Tokens</div>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={8192}
                  step={64}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="flex-1 accent-[#ff4da7]"
                />
                <div className="w-[84px] rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[12px] font-extrabold text-white/80">
                  {maxTokens}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => setForceParenthesis((v) => !v)}
                  className="w-full rounded-xl bg-white/[0.03] px-4 py-3 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.05]"
                >
                  Force Parenthesis: {forceParenthesis ? "ON" : "OFF"}
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setNsfwFilter((v) => !v)}
                  className="w-full rounded-xl bg-white/[0.03] px-4 py-3 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.05]"
                >
                  NSFW Filter: {nsfwFilter ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            <AdminButton onClick={saveProvider}>{selectedProvider === "anthropic" ? "Claude" : "Gemini"} 설정 저장</AdminButton>
          </div>

          <div className="mt-4 text-[11px] font-semibold leading-[1.5] text-white/35">
            실제 호출은 /api/llm/chat에서 Vercel env의 API 키로 수행합니다.
          </div>
        </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}
