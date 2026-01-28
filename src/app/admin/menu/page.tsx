"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminSectionHeader } from "../_components/AdminUI";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type MenuVisibility = {
  my: boolean;
  home: boolean;
  challenge: boolean;
  ranking: boolean;
  search: boolean;
};

const defaultVisibility: MenuVisibility = {
  my: true,
  home: true,
  challenge: true,
  ranking: true,
  search: true,
};

const menuLabels: Record<keyof MenuVisibility, string> = {
  my: "마이",
  home: "홈",
  challenge: "도전모드",
  ranking: "랭킹",
  search: "찾기",
};

export default function AdminMenuPage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [visibility, setVisibility] = useState<MenuVisibility>(defaultVisibility);
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
        .select("menu_visibility")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data?.menu_visibility) {
        setVisibility({ ...defaultVisibility, ...(data.menu_visibility as MenuVisibility) });
      } else {
        setVisibility(defaultVisibility);
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
      // 기존 레코드가 있는지 확인
      const { data: existing } = await supabase
        .from("panana_site_settings")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("panana_site_settings")
          .update({ menu_visibility: visibility })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("panana_site_settings")
          .insert({ menu_visibility: visibility });
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

  const toggleMenu = (key: keyof MenuVisibility) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="메뉴관리"
          subtitle="홈 화면의 탭 메뉴 노출/비노출을 관리합니다."
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

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="text-[13px] font-extrabold text-white/80 mb-4">메뉴 노출 설정</div>
          <div className="space-y-4">
            {(Object.keys(menuLabels) as Array<keyof MenuVisibility>).map((key) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[13px] font-semibold text-white/85">{menuLabels[key]}</div>
                <button
                  type="button"
                  onClick={() => toggleMenu(key)}
                  className={`h-8 w-14 rounded-full border border-white/10 p-1 transition-colors ${
                    visibility[key] ? "bg-[#ff4da7]" : "bg-white/[0.06]"
                  }`}
                >
                  <div
                    className={`h-6 w-6 rounded-full bg-white transition-transform ${
                      visibility[key] ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-[12px] font-semibold text-white/45">
            <div className="mb-2">💡 참고:</div>
            <ul className="list-disc list-inside space-y-1 text-white/35">
              <li>각 메뉴의 노출/비노출을 토글할 수 있습니다.</li>
              <li>변경사항은 저장 버튼을 클릭해야 적용됩니다.</li>
              <li>비노출된 메뉴는 홈 화면에서 보이지 않습니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}
