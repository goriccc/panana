"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminInput, AdminSectionHeader } from "../_components/AdminUI";
import { getBrowserSupabase } from "@/lib/supabase/browser";

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
  const selectedProvider = "gemini";
  const selected = rows.find((r) => r.scope === "global" && r.provider === selectedProvider) || null;

  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [forceParenthesis, setForceParenthesis] = useState(false);
  const [nsfwFilter, setNsfwFilter] = useState(true);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("panana_llm_settings")
        .select("id, scope, provider, model, temperature, max_tokens, top_p, force_parenthesis, nsfw_filter")
        .eq("scope", "global")
        .order("provider", { ascending: true });
      if (error) throw error;
      setRows((data || []) as any);
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

  const save = async () => {
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

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="LLM 설정"
          subtitle="API Key는 DB에 저장하지 않고 Vercel 환경변수로만 관리합니다. 여기서는 temperature/safety/model 같은 운영 파라미터만 관리합니다."
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

        <div className="mx-auto max-w-[420px] rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-[13px] font-extrabold text-white/80">Gemini 설정</div>
            <div className="mt-4 space-y-4">
              <div>
                <AdminInput
                  label="Model"
                  value={model}
                  onChange={setModel}
                  placeholder="예: gemini-2.5-flash, gemini-2.5-pro"
                />
                <div className="mt-2 text-[11px] font-semibold leading-[1.45] text-white/35">
                  사용할 모델 이름/ID 입니다. (프로바이더별 실제 API 모델 문자열과 일치해야 합니다)
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
                <div className="mt-2 text-[11px] font-semibold leading-[1.45] text-white/35">
                  창의성/다양성(랜덤성) 조절 값입니다. 높을수록 더 자유롭고, 낮을수록 더 안정적입니다.
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
                <div className="mt-2 text-[11px] font-semibold leading-[1.45] text-white/35">
                  Nucleus sampling 값입니다. 확률 상위 후보(누적 p) 범위에서만 선택해 출력의 보수성을 조절합니다.
                </div>
              </div>

              <div>
                <div className="text-[12px] font-bold text-white/55">Max Tokens</div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    // min=0 + step=64 로 맞춰야 1024(=64*16)를 정확히 선택 가능
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
                <div className="mt-2 text-[11px] font-semibold leading-[1.45] text-white/35">
                  기본값은 1024이며, 최대 8192까지 올릴 수 있습니다.
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
                  <div className="mt-2 text-[11px] font-semibold leading-[1.45] text-white/35">
                    응답에 (웃음), (잠시 침묵) 같은 괄호 연출/지시문을 더 적극적으로 사용하도록 유도합니다.
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setNsfwFilter((v) => !v)}
                    className="w-full rounded-xl bg-white/[0.03] px-4 py-3 text-[12px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.05]"
                  >
                    NSFW Filter: {nsfwFilter ? "ON" : "OFF"}
                  </button>
                  <div className="mt-2 text-[11px] font-semibold leading-[1.45] text-white/35">
                    선정적/성인/유해 콘텐츠를 더 보수적으로 제한하도록 유도합니다. (권장: ON)
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <AdminButton onClick={() => save()}>저장</AdminButton>
              </div>
            </div>

            <div className="mt-4 text-[11px] font-semibold leading-[1.5] text-white/35">
              이 페이지는 설정만 저장합니다. 실제 LLM 호출은 서버 라우트(`/api/llm/chat`)에서 Vercel env의 키로 수행하세요.
            </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}

