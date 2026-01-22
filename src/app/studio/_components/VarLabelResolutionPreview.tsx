"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

export type VarLabelScope = "project" | "scene" | "character";

type Props = {
  project?: Record<string, string> | null;
  scene?: Record<string, string> | null;
  character?: Record<string, string> | null;
  className?: string;
  title?: string;
  // 어떤 편집 화면에서 보고 있는지(배지/가이드용)
  editingScope?: VarLabelScope;
};

function normMap(input?: Record<string, string> | null) {
  const src = input && typeof input === "object" ? input : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    const key = String(k || "").trim().toLowerCase();
    const val = String(v || "").trim();
    if (!key || !val) continue;
    out[key] = val;
  }
  return out;
}

export function VarLabelResolutionPreview(props: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const maps = useMemo(() => {
    const project = normMap(props.project);
    const scene = normMap(props.scene);
    const character = normMap(props.character);
    return { project, scene, character };
  }, [props.project, props.scene, props.character]);

  const rows = useMemo(() => {
    const keys = new Set<string>([
      ...Object.keys(maps.project),
      ...Object.keys(maps.scene),
      ...Object.keys(maps.character),
    ]);

    const all = Array.from(keys)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => {
        const p = maps.project[key] || "";
        const s = maps.scene[key] || "";
        const c = maps.character[key] || "";
        const final = c || s || p || "";
        const source: VarLabelScope | "" = c ? "character" : s ? "scene" : p ? "project" : "";
        const conflict = Boolean(final && ((p && p !== final) || (s && s !== final) || (c && c !== final)));
        return { key, p, s, c, final, source, conflict };
      })
      .filter((r) => r.final);

    const query = String(q || "").trim().toLowerCase();
    const filtered = query ? all.filter((r) => r.key.includes(query) || r.final.toLowerCase().includes(query)) : all;
    const conflicts = filtered.filter((r) => r.conflict).length;
    return { filtered, total: all.length, conflicts };
  }, [maps.character, maps.project, maps.scene, q]);

  const scopeBadge =
    props.editingScope === "character"
      ? "캐릭터(최우선)"
      : props.editingScope === "scene"
        ? "씬(중간)"
        : props.editingScope === "project"
          ? "프로젝트(기본)"
          : null;

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-black/15 p-4", props.className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[13px] font-extrabold text-white/85">{props.title || "변수 라벨 충돌/적용 미리보기"}</div>
            {scopeBadge ? (
              <span className="rounded-full bg-white/[0.06] px-2 py-[2px] text-[10px] font-extrabold text-white/60 ring-1 ring-white/10">
                {scopeBadge}
              </span>
            ) : null}
            <span className="text-[10px] font-extrabold text-white/35">
              적용 우선순위: <span className="text-white/55">캐릭터 &gt; 씬 &gt; 프로젝트</span>
            </span>
          </div>
          <div className="mt-1 text-[11px] font-semibold text-white/35">
            동일 키가 여러 스코프에 있을 때, <span className="text-white/60">최종 라벨</span>과 <span className="text-white/60">출처</span>를 보여줍니다.
            <span className="ml-2 text-white/45">충돌은 &quot;⚠&quot;로 표시됩니다.</span>
          </div>
        </div>

        <button
          type="button"
          className="rounded-lg bg-white/[0.06] px-3 py-2 text-[11px] font-extrabold text-white/75 ring-1 ring-white/10 hover:bg-white/[0.08]"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "접기" : "펼치기"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-extrabold text-white/45">
        <span className="rounded-full bg-black/20 px-3 py-1 ring-1 ring-white/10">총 키: {rows.total}</span>
        <span className={cn("rounded-full bg-black/20 px-3 py-1 ring-1 ring-white/10", rows.conflicts ? "text-[#ff9aa1]" : "")}>
          충돌: {rows.conflicts}
        </span>
      </div>

      {open ? (
        <>
          <div className="mt-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="키/라벨 검색 (예: contract, 스트레스)"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[12px] font-semibold text-white/80 outline-none placeholder:text-white/25"
            />
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[160px_1fr_120px] gap-2 bg-black/25 px-4 py-3 text-[11px] font-extrabold text-white/55">
              <div>키</div>
              <div>최종 라벨</div>
              <div>출처</div>
            </div>
            <div className="max-h-[280px] overflow-auto bg-black/15">
              {rows.filtered.length ? (
                rows.filtered.map((r) => (
                  <div key={r.key} className="grid grid-cols-[160px_1fr_120px] gap-2 border-t border-white/10 px-4 py-3">
                    <div className="truncate text-[12px] font-extrabold text-white/75">{r.key}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[12px] font-extrabold text-white/80">{r.final}</div>
                        {r.conflict ? <div className="text-[12px] font-extrabold text-[#ff9aa1]">⚠</div> : null}
                      </div>
                      {r.conflict ? (
                        <div className="mt-1 text-[11px] font-semibold text-white/35">
                          {r.c ? <span className="mr-2">C: {r.c}</span> : null}
                          {r.s ? <span className="mr-2">S: {r.s}</span> : null}
                          {r.p ? <span className="mr-2">P: {r.p}</span> : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-[11px] font-extrabold text-white/55">
                      {r.source === "character" ? "캐릭터" : r.source === "scene" ? "씬" : "프로젝트"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-[12px] font-semibold text-white/45">표시할 라벨이 없어요.</div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

