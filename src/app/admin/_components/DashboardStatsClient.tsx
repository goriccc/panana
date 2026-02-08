"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { AdminSectionHeader } from "./AdminUI";

type ByGender = { label: string; count: number; ratio: number };
type StatsPayload = {
  ok: boolean;
  period?: string;
  from?: string;
  to?: string;
  inflow?: { total: number; unique: number; byPeriod?: { total: number; unique: number } };
  usersByGender?: {
    total: number;
    male: number;
    female: number;
    both: number;
    private: number;
    byGender: ByGender[];
  };
  airportAgeByGender?: Record<string, Record<string, number> & { total?: Record<string, number> }>;
  chatUsersByPeriodGender?: { total: number; male: number; female: number; both: number; private: number };
  avgDwellByGender?: { male: number; female: number; both: number; private: number };
  avgChatDurationByGender?: { male: number; female: number; both: number; private: number };
  characterCounts?: { total: number; male: number; female: number };
  popularCharacters?: {
    male: Array<{ slug: string; name?: string; profile_image_url?: string; userCount: number; avgDurationMin: number }>;
    female: Array<{ slug: string; name?: string; profile_image_url?: string; userCount: number; avgDurationMin: number }>;
  };
  characterMeta?: Record<string, { name: string; profile_image_url: string }>;
  characterAvgChatByGender?: Array<{
    character_slug: string;
    male: number;
    female: number;
    both: number;
    private: number;
  }>;
  characterAgeByGender?: Array<{
    character_slug: string;
    male: Record<string, number>;
    female: Record<string, number>;
    both: Record<string, number>;
    private: Record<string, number>;
    total: Record<string, number>;
  }>;
  airportStepRatios?: {
    purpose: Record<string, Record<string, number>>;
    mood: Record<string, Record<string, number>>;
    character_type: Record<string, Record<string, number>>;
  };
  sceneImageCounts?: {
    total: number;
    male?: Array<{ slug: string; name?: string; profile_image_url?: string; imageCount: number }>;
    female?: Array<{ slug: string; name?: string; profile_image_url?: string; imageCount: number }>;
  };
};

const PERIODS = [
  { value: "all", label: "전체" },
  { value: "day", label: "일별" },
  { value: "week", label: "주별" },
  { value: "month", label: "월별" },
  { value: "custom", label: "기간지정" },
];

const AGE_BANDS = ["10s", "20s", "30s", "40s", "50s", "60+"] as const;

const AGE_BAND_LABELS: Record<string, string> = {
  "10s": "10대",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s": "50대",
  "60+": "60대+",
};

const STEP_PIE_COLORS = ["#4F7CFF", "#ec4899", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#84cc16", "#f43f5e"];
const AGE_BAND_COLORS: Record<string, string> = {
  "10대": STEP_PIE_COLORS[0],
  "20대": STEP_PIE_COLORS[1],
  "30대": STEP_PIE_COLORS[2],
  "40대": STEP_PIE_COLORS[3],
  "50대": STEP_PIE_COLORS[4],
  "60대+": STEP_PIE_COLORS[5],
};

/** 연령대 키로 값을 읽을 때 undefined 접근 방지 */
function getBandValue(obj: unknown, band: string): number {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return 0;
  const val = (obj as Record<string, unknown>)[band];
  return typeof val === "number" ? val : 0;
}

const GENDER_LABELS: Record<string, string> = {
  male: "남성",
  female: "여성",
  both: "둘다 선택",
  private: "선택안함",
  total: "전체종합",
};

const GENDERS = ["male", "female", "both", "private"] as const;

/** 입국심사 스탭별 답변 키 → 실제 문장 (airport/chat/ui.tsx와 동일) */
const AIRPORT_STEP_LABELS: Record<string, Record<string, string>> = {
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
  character_type: {
    gentle: "다정한 타입",
    care: "무심한 듯 챙겨주는 타입",
    confident: "자신감 넘치는 타입",
    mystery: "비밀 많은 타입",
    cute: "귀여운 타입",
  },
};

const AIRPORT_STEP_TITLES: Record<string, string> = {
  purpose: "Step 1 – 목적",
  mood: "Step 2 – 분위기",
  character_type: "Step 3 – 캐릭터 타입",
};

/** 비율 기반 원형 그래프 (label, ratio 0~1). compact면 SVG만 표시(범례 없음). colorMap 있으면 라벨별 색 고정. innerText: 슬라이스 안 텍스트(라벨 또는 %만). legendOnRight: 범례를 원형 오른쪽에 고정. innerFontScale: 원 안 글자 크기 배율(1 미만이면 작게) */
function RatioPieChart({
  data,
  size = 100,
  compact = false,
  colorMap,
  innerText = "label",
  legendOnRight = false,
  innerFontScale = 1,
}: {
  data: Array<{ label: string; ratio: number }>;
  size?: number;
  compact?: boolean;
  colorMap?: Record<string, string>;
  innerText?: "label" | "percent";
  legendOnRight?: boolean;
  innerFontScale?: number;
}) {
  const filtered = data.filter((d) => d.ratio > 0);
  if (!filtered.length) return <div className="text-[11px] text-white/45">데이터 없음</div>;
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const labelDist = r * 0.6;
  const baseFontSize =
    innerText === "percent"
      ? Math.max(8, Math.round(size * 0.11))
      : Math.max(8, Math.round(size * 0.14));
  const fontSize = Math.max(6, Math.round(baseFontSize * innerFontScale));
  let startAngle = -90;
  const slices = filtered.map((d, i) => {
    const angle = d.ratio * 360;
    const endAngle = startAngle + angle;
    const midAngleDeg = startAngle + angle / 2;
    const midRad = (midAngleDeg * Math.PI) / 180;
    const tx = cx + labelDist * Math.cos(midRad);
    const ty = cy + labelDist * Math.sin(midRad);
    const color = colorMap?.[d.label] ?? STEP_PIE_COLORS[i % STEP_PIE_COLORS.length];
    let dPath: string;
    if (angle >= 359.99) {
      const top = cy - r;
      const bottom = cy + r;
      dPath = `M ${cx} ${cy} L ${cx} ${top} A ${r} ${r} 0 1 1 ${cx} ${bottom} A ${r} ${r} 0 1 1 ${cx} ${top} Z`;
    } else {
      const start = (startAngle * Math.PI) / 180;
      const end = (endAngle * Math.PI) / 180;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const large = angle > 180 ? 1 : 0;
      dPath = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    }
    startAngle = endAngle;
    return { label: d.label, ratio: d.ratio, dPath, color, tx, ty };
  });
  const svg = (
    <svg width={size} height={size} className="shrink-0">
      {slices.map((s) => (
        <path key={s.label} d={s.dPath} fill={s.color} />
      ))}
      {slices.map((s) => {
        const textContent =
          innerText === "percent" ? `${(s.ratio * 100).toFixed(1)}%` : s.label;
        return (
          <text
            key={`t-${s.label}`}
            x={s.tx}
            y={s.ty}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={fontSize}
            className="pointer-events-none select-none"
            style={{ textShadow: "0 0 2px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.6)" }}
          >
            {textContent}
          </text>
        );
      })}
    </svg>
  );
  if (compact) return svg;
  return (
    <div
      className={`flex items-start gap-2 text-[11px] ${legendOnRight ? "flex-nowrap" : "flex-wrap"}`}
    >
      {svg}
      <div className="min-w-0 shrink-0 space-y-0.5">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-white/70">{s.label}</span>
            <span className="text-white/50">{(s.ratio * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const GENDER_PIE_COLORS: Record<string, string> = {
  남성: "#4F7CFF",
  여성: "#ec4899",
  "둘다 선택": "#10b981",
  선택안함: "#f59e0b",
};

function PieChart({ data }: { data: ByGender[] }) {
  if (!data.length) return <div className="text-[12px] text-white/45">데이터 없음</div>;
  const total = data.reduce((a, b) => a + b.count, 0);
  if (total === 0) return <div className="text-[12px] text-white/45">0건</div>;
  const size = 128;
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  let startAngle = -90;
  const slices = data.map((d) => {
    const ratio = d.count / total;
    const angle = ratio * 360;
    const endAngle = startAngle + angle;
    const color = GENDER_PIE_COLORS[d.label] ?? "#6b7280";
    const start = (startAngle * Math.PI) / 180;
    const end = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = angle > 180 ? 1 : 0;
    const dPath = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    startAngle = endAngle;
    return { label: d.label, count: d.count, dPath, color };
  });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg
        width={size}
        height={size}
        className="shrink-0"
        style={{ transform: "rotate(0deg)" }}
      >
        {slices.map((s) => (
          <path key={s.label} d={s.dPath} fill={s.color} />
        ))}
      </svg>
      <div className="space-y-1">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-[12px]">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: GENDER_PIE_COLORS[d.label] ?? "#6b7280" }}
            />
            <span className="text-white/70">{d.label}</span>
            <span className="font-semibold text-white/90">{d.count}</span>
            <span className="text-white/45">({((d.count / total) * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatMinutes(m: number): string {
  if (m < 1) return `${Math.round(m * 60)}초`;
  if (m < 60) return `${m.toFixed(1)}분`;
  return `${(m / 60).toFixed(1)}시간`;
}

function CharacterCell({
  slug,
  name,
  profileImageUrl,
  onImageClick,
}: {
  slug: string;
  name?: string;
  profileImageUrl?: string;
  onImageClick: (url: string) => void;
}) {
  const displayName = name || slug;
  const url = profileImageUrl || "";
  return (
    <div className="flex items-center gap-2">
      {url ? (
        <button
          type="button"
          onClick={() => onImageClick(url)}
          className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 ring-0 transition hover:ring-2 hover:ring-white/20"
        >
          <img src={url} alt={displayName} className="h-full w-full object-cover" />
        </button>
      ) : (
        <span className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
      )}
      <span className="truncate text-white/90">{displayName}</span>
    </div>
  );
}

export function DashboardStatsClient() {
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enlargeImageUrl, setEnlargeImageUrl] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) {
        setError("로그인이 필요해요.");
        setData(null);
        return;
      }
      const params = new URLSearchParams({ period });
      if (period === "custom" && from) params.set("from", from);
      if (period === "custom" && to) params.set("to", to);
      const res = await fetch(`/api/admin/stats?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as StatsPayload & { error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error || "통계를 불러오지 못했어요.");
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading && !data) {
    return (
      <div className="py-8 text-center text-[13px] font-semibold text-white/50">
        통계 불러오는 중...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="text-[13px] font-semibold text-[#ff9aa1]">{error}</div>
        <button
          type="button"
          className="mt-2 rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-extrabold text-white/80"
          onClick={() => fetchStats()}
        >
          다시 시도
        </button>
      </div>
    );
  }

  const d = data!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] font-bold text-white/55">기간</span>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0f1014] px-3 py-2 text-[13px] font-semibold text-white"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {period === "custom" && (
          <>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/85"
            />
            <span className="text-white/45">~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/85"
            />
          </>
        )}
        <button
          type="button"
          onClick={() => fetchStats()}
          className="rounded-xl bg-[#ff4da7] px-4 py-2 text-[12px] font-extrabold text-white"
        >
          새로고침
        </button>
      </div>

      {/* 유입통계 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader title="유입통계" subtitle="총유입수(중복허용), 유니크 유입수" />
        <div className="mt-1.5 flex gap-6 text-[13px]">
          <div>
            <span className="text-white/55">총 유입수(중복허용): </span>
            <span className="font-bold text-white/90">{d.inflow?.total ?? 0}</span>
          </div>
          <div>
            <span className="text-white/55">유니크 유입수: </span>
            <span className="font-bold text-white/90">{d.inflow?.unique ?? 0}</span>
          </div>
        </div>
      </section>

      {/* 계정생성 유저 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader title="계정생성 유저" subtitle="총 수, 남성/여성/둘다 선택/선택안함별 수·비율, 원형그래프" />
        <div className="mt-1.5 flex gap-6 text-[13px]">
          <span className="text-white/55">총 유저 수: </span>
          <span className="font-bold text-white/90">{d.usersByGender?.total ?? 0}</span>
        </div>
        <div className="mt-1.5">
          <PieChart data={d.usersByGender?.byGender ?? []} />
        </div>
      </section>

      {/* 입국심사 연령대 (원형 그래프) */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader
          title="입국심사 연령대 (생년월일 기준)"
          subtitle="전체·남성·여성·둘다 선택·선택안함별 연령대 비율"
        />
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/50">
          {AGE_BANDS.map((band) => {
            const label = AGE_BAND_LABELS[band] ?? band;
            return (
              <span key={band} className="flex items-center gap-1">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: AGE_BAND_COLORS[label] ?? "#6b7280" }}
                />
                {label}
              </span>
            );
          })}
        </div>
        <div className="mt-2 flex flex-row flex-wrap items-center gap-6">
          {/* 왼쪽: 전체종합 (오른쪽 2×2 그리드 높이 중간에 정렬) */}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <span className="text-[10px] font-medium text-white/70">전체종합</span>
            <RatioPieChart
              data={
                AGE_BANDS.map((band) => ({
                  label: AGE_BAND_LABELS[band] ?? band,
                  ratio: getBandValue(d.airportAgeByGender?.total, band) as number,
                })).filter((d) => d.ratio > 0) as Array<{ label: string; ratio: number }>
              }
              size={168}
              colorMap={AGE_BAND_COLORS}
              innerFontScale={0.82}
            />
          </div>
          {/* 오른쪽: 2×2 그리드 (남성, 여성, 둘다선택, 선택안함) */}
          <div className="grid grid-cols-2 gap-4">
            {(["male", "female", "both", "private"] as const).map((g) => {
              const labels: Record<string, string> = {
                male: "남성",
                female: "여성",
                both: "둘다 선택",
                private: "선택안함",
              };
              const row = d.airportAgeByGender?.[g];
              const sum = AGE_BANDS.reduce((s, b) => s + getBandValue(row, b), 0);
              const pieData =
                sum > 0
                  ? AGE_BANDS.map((band) => ({
                      label: AGE_BAND_LABELS[band] ?? band,
                      ratio: getBandValue(row, band) / sum,
                    })).filter((d) => d.ratio > 0)
                  : [];
              return (
                <div key={g} className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] font-medium text-white/60">{labels[g]}</span>
                  <RatioPieChart data={pieData} size={120} colorMap={AGE_BAND_COLORS} innerFontScale={0.82} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 대화 실행 유저 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader
          title="대화 실행 유저"
          subtitle="실제 대화한 유저 수 (선택 기간), 남성/여성/둘다 선택/선택안함별"
        />
        <div className="mt-1.5 flex flex-wrap gap-4 text-[13px]">
          <span className="font-bold text-white/90">총 {d.chatUsersByPeriodGender?.total ?? 0}명</span>
          <span className="text-white/55">남성 {d.chatUsersByPeriodGender?.male ?? 0}</span>
          <span className="text-white/55">여성 {d.chatUsersByPeriodGender?.female ?? 0}</span>
          <span className="text-white/55">둘다 선택 {d.chatUsersByPeriodGender?.both ?? 0}</span>
          <span className="text-white/55">선택안함 {d.chatUsersByPeriodGender?.private ?? 0}</span>
        </div>
      </section>

      {/* 서비스 머문 평균 시간 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader title="파나나 서비스 머문 평균 시간" subtitle="남성/여성/둘다 선택/선택안함별 (분)" />
        <div className="mt-1.5 flex flex-wrap gap-6 text-[13px]">
          <span>남성: {formatMinutes(d.avgDwellByGender?.male ?? 0)}</span>
          <span>여성: {formatMinutes(d.avgDwellByGender?.female ?? 0)}</span>
          <span>둘다 선택: {formatMinutes(d.avgDwellByGender?.both ?? 0)}</span>
          <span>선택안함: {formatMinutes(d.avgDwellByGender?.private ?? 0)}</span>
        </div>
      </section>

      {/* 대화 평균 시간 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader title="유저 대화 평균 시간" subtitle="남성/여성/둘다 선택/선택안함별" />
        <div className="mt-1.5 flex flex-wrap gap-6 text-[13px]">
          <span>남성: {formatMinutes(d.avgChatDurationByGender?.male ?? 0)}</span>
          <span>여성: {formatMinutes(d.avgChatDurationByGender?.female ?? 0)}</span>
          <span>둘다 선택: {formatMinutes(d.avgChatDurationByGender?.both ?? 0)}</span>
          <span>선택안함: {formatMinutes(d.avgChatDurationByGender?.private ?? 0)}</span>
        </div>
      </section>

      {/* 노출 캐릭터 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader title="노출 캐릭터" subtitle="총 수, 남성/여성 캐릭터 수" />
        <div className="mt-1.5 flex flex-wrap gap-6 text-[13px]">
          <span className="font-bold text-white/90">총 {d.characterCounts?.total ?? 0}명</span>
          <span>남성 캐릭터 {d.characterCounts?.male ?? 0}</span>
          <span>여성 캐릭터 {d.characterCounts?.female ?? 0}</span>
        </div>
      </section>

      {/* 인기 캐릭터 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader
          title="인기 캐릭터"
          subtitle="남성/여성 캐릭터별 톱20 (최근 30일 대화한 유저 수 내림차순)·평균 대화 지속 시간"
        />
        <div className="mt-1.5 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[13px] font-bold text-white/80">남성 캐릭터 톱20</div>
            <div className="admin-scroll max-h-48 overflow-auto">
              <table className="min-w-full text-[12px]">
                <thead>
                  <tr className="bg-white/[0.03]">
                    <th className="px-2 py-1 text-left">캐릭터</th>
                    <th className="px-2 py-1 text-right">유저 수</th>
                    <th className="px-2 py-1 text-right">평균 대화시간</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.popularCharacters?.male ?? []).map((c) => (
                    <tr key={c.slug} className="border-t border-white/10">
                      <td className="px-2 py-1">
                        <CharacterCell
                          slug={c.slug}
                          name={c.name}
                          profileImageUrl={c.profile_image_url}
                          onImageClick={setEnlargeImageUrl}
                        />
                      </td>
                      <td className="px-2 py-1 text-right">{c.userCount}</td>
                      <td className="px-2 py-1 text-right">{formatMinutes(c.avgDurationMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[13px] font-bold text-white/80">여성 캐릭터 톱20</div>
            <div className="admin-scroll max-h-48 overflow-auto">
              <table className="min-w-full text-[12px]">
                <thead>
                  <tr className="bg-white/[0.03]">
                    <th className="px-2 py-1 text-left">캐릭터</th>
                    <th className="px-2 py-1 text-right">유저 수</th>
                    <th className="px-2 py-1 text-right">평균 대화시간</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.popularCharacters?.female ?? []).map((c) => (
                    <tr key={c.slug} className="border-t border-white/10">
                      <td className="px-2 py-1">
                        <CharacterCell
                          slug={c.slug}
                          name={c.name}
                          profileImageUrl={c.profile_image_url}
                          onImageClick={setEnlargeImageUrl}
                        />
                      </td>
                      <td className="px-2 py-1 text-right">{c.userCount}</td>
                      <td className="px-2 py-1 text-right">{formatMinutes(c.avgDurationMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 캐릭터별 대화 평균 시간 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader title="캐릭터별 대화 평균 시간" subtitle="남성/여성/둘다 선택/선택안함별" />
        <div className="admin-scroll mt-1.5 max-h-48 overflow-auto">
          <table className="min-w-full text-[12px]">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="px-2 py-1 text-left">캐릭터</th>
                <th className="px-2 py-1 text-right">남성</th>
                <th className="px-2 py-1 text-right">여성</th>
                <th className="px-2 py-1 text-right">둘다 선택</th>
                <th className="px-2 py-1 text-right">선택안함</th>
              </tr>
            </thead>
            <tbody>
              {(d.characterAvgChatByGender ?? []).map((r) => {
                const meta = d.characterMeta?.[r.character_slug];
                return (
                  <tr key={r.character_slug} className="border-t border-white/10">
                    <td className="px-2 py-1">
                      <CharacterCell
                        slug={r.character_slug}
                        name={meta?.name}
                        profileImageUrl={meta?.profile_image_url}
                        onImageClick={setEnlargeImageUrl}
                      />
                    </td>
                    <td className="px-2 py-1 text-right">{formatMinutes(r.male)}</td>
                    <td className="px-2 py-1 text-right">{formatMinutes(r.female)}</td>
                    <td className="px-2 py-1 text-right">{formatMinutes(r.both)}</td>
                    <td className="px-2 py-1 text-right">{formatMinutes(r.private)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 캐릭터별 대화 연령대 비율 (전체·남성·여성·둘다·선택안함별 원형 그래프) */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader
          title="캐릭터별 대화 연령대 비율"
          subtitle="전체·남성·여성·둘다 선택·선택안함별 연령대 비율"
        />
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/50">
          {AGE_BANDS.map((band) => {
            const label = AGE_BAND_LABELS[band] ?? band;
            return (
              <span key={band} className="flex items-center gap-1">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: AGE_BAND_COLORS[label] ?? "#6b7280" }}
                />
                {label}
              </span>
            );
          })}
        </div>
        <div className="admin-scroll mt-2 max-h-[32rem] overflow-auto">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(d.characterAgeByGender ?? []).map((row) => {
              const meta = d.characterMeta?.[row.character_slug];
              const genderKeys = ["total", "male", "female", "both", "private"] as const;
              const genderLabels: Record<string, string> = {
                total: "전체",
                male: "남성",
                female: "여성",
                both: "둘다",
                private: "선택안함",
              };
              return (
                <div
                  key={row.character_slug}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-2"
                >
                  <div className="flex items-center gap-2">
                    <CharacterCell
                      slug={row.character_slug}
                      name={meta?.name}
                      profileImageUrl={meta?.profile_image_url}
                      onImageClick={setEnlargeImageUrl}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-2">
                    {genderKeys.map((g) => {
                      const bandData = row[g];
                      const sum = AGE_BANDS.reduce((s, b) => s + getBandValue(bandData, b), 0);
                      const pieData =
                        sum > 0
                          ? AGE_BANDS.map((band) => ({
                              label: AGE_BAND_LABELS[band] ?? band,
                              ratio: getBandValue(bandData, band) / sum,
                            })).filter((d) => d.ratio > 0)
                          : [];
                      return (
                        <div key={g} className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] text-white/55">{genderLabels[g]}</span>
                          <RatioPieChart data={pieData} size={72} compact colorMap={AGE_BAND_COLORS} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 입국심사 스탭별 답변 비율 (원형 그래프) */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader
          title="입국심사 스탭별 답변 비율"
          subtitle="전체종합 기준 원형 그래프"
        />
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
          {(["purpose", "mood", "character_type"] as const).map((step) => {
            const labelMap = AIRPORT_STEP_LABELS[step] ?? {};
            const stepTitle = AIRPORT_STEP_TITLES[step] ?? step;
            const totalMap = d.airportStepRatios?.[step]?.total;
            const pieData =
              totalMap && typeof totalMap === "object"
                ? Object.entries(totalMap)
                    .filter(([, v]) => Number(v) > 0)
                    .map(([k, v]) => ({ label: labelMap[k] ?? k, ratio: Number(v) }))
                : [];
            return (
              <div key={step} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-[11px] font-bold text-white/60">{stepTitle}</div>
                <div className="mt-1">
                  <RatioPieChart
                    data={pieData}
                    size={112}
                    innerText="percent"
                    legendOnRight={step === "character_type"}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 대화중 이미지생성 */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <AdminSectionHeader
          title="대화중 이미지생성"
          subtitle="선택 기간 내 장면 이미지 생성 수, 남성/여성 캐릭터별 톱20 (panana_scene_image_log)"
        />
        <div className="mt-1.5">
          <div className="mb-3 text-[13px]">
            <span className="text-white/55">총 생성 수: </span>
            <span className="font-bold text-white/90">{d.sceneImageCounts?.total ?? 0}</span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-[13px] font-bold text-white/80">남성 캐릭터 톱20 (이미지 생성 수)</div>
              <div className="admin-scroll max-h-48 overflow-auto">
                <table className="min-w-full text-[12px]">
                  <thead>
                    <tr className="bg-white/[0.03]">
                      <th className="px-2 py-1 text-left">캐릭터</th>
                      <th className="px-2 py-1 text-right">생성 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(d.sceneImageCounts?.male ?? []).map((c) => (
                      <tr key={c.slug} className="border-t border-white/10">
                        <td className="px-2 py-1">
                          <CharacterCell
                            slug={c.slug}
                            name={c.name}
                            profileImageUrl={c.profile_image_url}
                            onImageClick={setEnlargeImageUrl}
                          />
                        </td>
                        <td className="px-2 py-1 text-right">{c.imageCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="mb-2 text-[13px] font-bold text-white/80">여성 캐릭터 톱20 (이미지 생성 수)</div>
              <div className="admin-scroll max-h-48 overflow-auto">
                <table className="min-w-full text-[12px]">
                  <thead>
                    <tr className="bg-white/[0.03]">
                      <th className="px-2 py-1 text-left">캐릭터</th>
                      <th className="px-2 py-1 text-right">생성 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(d.sceneImageCounts?.female ?? []).map((c) => (
                      <tr key={c.slug} className="border-t border-white/10">
                        <td className="px-2 py-1">
                          <CharacterCell
                            slug={c.slug}
                            name={c.name}
                            profileImageUrl={c.profile_image_url}
                            onImageClick={setEnlargeImageUrl}
                          />
                        </td>
                        <td className="px-2 py-1 text-right">{c.imageCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 이미지 확대 모달 */}
      {enlargeImageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black/80 p-4"
          onClick={() => setEnlargeImageUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="이미지 확대"
        >
          <div
            className="flex max-h-[90vh] max-w-full flex-col items-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="shrink-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-[13px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
              onClick={() => setEnlargeImageUrl(null)}
            >
              닫기
            </button>
            <img
              src={enlargeImageUrl}
              alt="확대"
              className="max-h-[85vh] max-w-full shrink-0 rounded-xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
