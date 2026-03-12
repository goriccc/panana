"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AdminAuthGate } from "../_components/AdminAuthGate";
import { AdminButton, AdminInput, AdminSectionHeader } from "../_components/AdminUI";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  createMembershipBanner,
  deleteMembershipBanner,
  listMembershipBanners,
  updateMembershipBanner,
  uploadMembershipBannerImage,
  type MembershipBannerRow,
} from "@/lib/pananaAdmin/membershipBanners";

const PANANA_PASS_PLAN_KEY = "panana_pass";

type MembershipPlanRow = {
  id: string;
  plan_key: string;
  title: string;
  payment_sku: string | null;
  price_krw: number | null;
};

export default function AdminMembershipPage() {
  const [plan, setPlan] = useState<MembershipPlanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [paymentSku, setPaymentSku] = useState("");
  const [priceKrw, setPriceKrw] = useState("");

  const [banner, setBanner] = useState<MembershipBannerRow | null>(null);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [bTitle, setBTitle] = useState("");
  const [bLinkUrl, setBLinkUrl] = useState("");
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerDragOver, setBannerDragOver] = useState(false);

  const loadPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = getBrowserSupabase();
      const { data, error: e } = await sb
        .from("panana_membership_plans")
        .select("id, plan_key, title, payment_sku, price_krw")
        .eq("plan_key", PANANA_PASS_PLAN_KEY)
        .maybeSingle();
      if (e) throw e;
      const row = data as MembershipPlanRow | null;
      setPlan(row ?? null);
      if (row) {
        setPaymentSku(String(row.payment_sku ?? "").trim());
        setPriceKrw(String(row.price_krw ?? "") === "" ? "" : String(Number(row.price_krw)));
      } else {
        setPaymentSku("");
        setPriceKrw("");
      }
    } catch (err: any) {
      setError(err?.message || "플랜을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  const createPlan = async () => {
    setSaving(true);
    setError(null);
    try {
      const sb = getBrowserSupabase();
      const { data, error: e } = await sb
        .from("panana_membership_plans")
        .insert({
          plan_key: PANANA_PASS_PLAN_KEY,
          title: "파나나 패스",
          price_label: "14,900원/월",
          sort_order: 0,
          active: true,
        })
        .select("id, plan_key, title")
        .single();
      if (e) throw e;
      const row = data as { id: string; plan_key: string; title: string };
      setPlan({
        id: row.id,
        plan_key: row.plan_key,
        title: row.title,
        payment_sku: null,
        price_krw: null,
      });
      setPaymentSku("panana_pass_monthly");
      setPriceKrw("14900");
    } catch (err: any) {
      setError(err?.message || "플랜 생성에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const loadBanner = async () => {
    setBannerLoading(true);
    try {
      const rows = await listMembershipBanners();
      const first = rows[0] ?? null;
      setBanner(first);
      if (first) {
        setBTitle(first.title || "");
        setBLinkUrl(first.link_url || "");
      } else {
        setBTitle("");
        setBLinkUrl("");
      }
    } catch {
      setBanner(null);
    } finally {
      setBannerLoading(false);
    }
  };

  useEffect(() => {
    loadPlan();
    loadBanner();
  }, []);

  const savePlan = async () => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      const sb = getBrowserSupabase();
      const sku = paymentSku.trim() || null;
      const num = priceKrw.trim() === "" ? null : Number(priceKrw);
      const price_krw = num != null && Number.isFinite(num) ? Math.max(0, num) : null;
      const { data, error: e } = await sb
        .from("panana_membership_plans")
        .update({ payment_sku: sku, price_krw })
        .eq("id", plan.id)
        .select("id, plan_key, title, payment_sku, price_krw")
        .single();
      if (e) throw e;
      setPlan(data as MembershipPlanRow);
    } catch (err: any) {
      setError(err?.message || "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const addBanner = async () => {
    setBannerSaving(true);
    setError(null);
    try {
      const row = await createMembershipBanner();
      setBanner(row);
      setBTitle(row.title || "");
      setBLinkUrl(row.link_url || "");
    } catch (err: any) {
      setError(err?.message || "배너 추가에 실패했어요.");
    } finally {
      setBannerSaving(false);
    }
  };

  const saveBanner = async () => {
    if (!banner) return;
    setBannerSaving(true);
    setError(null);
    try {
      const row = await updateMembershipBanner(banner.id, {
        title: bTitle.trim(),
        link_url: bLinkUrl.trim() || "/my/membership",
      });
      setBanner(row);
    } catch (err: any) {
      setError(err?.message || "배너 저장에 실패했어요.");
    } finally {
      setBannerSaving(false);
    }
  };

  const onBannerImageUpload = async (file: File) => {
    if (!banner) return;
    setError(null);
    try {
      const { imageUrl, path } = await uploadMembershipBannerImage(banner.id, file);
      setBanner((prev) => (prev ? { ...prev, image_url: imageUrl, image_path: path } : null));
    } catch (err: any) {
      setError(err?.message || "이미지 업로드에 실패했어요.");
    }
  };

  const deleteBanner = async () => {
    if (!banner) return;
    if (!confirm(`"${banner.title || "배너"}"를 삭제할까요?`)) return;
    setBannerSaving(true);
    setError(null);
    try {
      await deleteMembershipBanner(banner.id);
      setBanner(null);
      setBTitle("");
      setBLinkUrl("");
    } catch (err: any) {
      setError(err?.message || "배너 삭제에 실패했어요.");
    } finally {
      setBannerSaving(false);
    }
  };

  return (
    <AdminAuthGate>
      <div>
        <AdminSectionHeader
          title="멤버십"
          subtitle="파나나 패스(panana_pass) 결제코드 SKU·결제금액과 멤버십 배너 1개를 등록·편집합니다."
          right={
            <AdminButton variant="ghost" onClick={() => { loadPlan(); loadBanner(); }} disabled={loading}>
              새로고침
            </AdminButton>
          }
        />

        {error ? <div className="mb-3 text-[12px] font-semibold text-[#ff9aa1]">{error}</div> : null}
        {loading ? <div className="mb-3 text-[12px] font-semibold text-white/45">불러오는 중...</div> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 결제 설정 */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-[13px] font-extrabold text-white/80">결제 설정</div>
            {plan ? (
              <div className="mt-4 space-y-4">
                <div className="text-[12px] font-semibold text-white/45">
                  플랜: {plan.title} ({plan.plan_key})
                </div>
                <AdminInput
                  label="결제코드 SKU"
                  value={paymentSku}
                  onChange={setPaymentSku}
                  placeholder="예: panana_pass_monthly"
                />
                <AdminInput
                  label="결제금액 (KRW)"
                  value={priceKrw}
                  onChange={setPriceKrw}
                  placeholder="예: 14900"
                />
                <AdminButton onClick={savePlan} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </AdminButton>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-[12px] font-semibold text-white/45">panana_pass 플랜이 없어요.</p>
                <div className="mt-3">
                  <AdminButton onClick={createPlan} disabled={saving}>
                    {saving ? "생성 중..." : "플랜 생성"}
                  </AdminButton>
                </div>
              </div>
            )}
          </div>

          {/* 배너 1개 */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-[13px] font-extrabold text-white/80">멤버십 배너 (1개)</div>
            {bannerLoading ? (
              <div className="mt-3 text-[12px] font-semibold text-white/45">불러오는 중...</div>
            ) : banner ? (
              <div className="mt-4 space-y-4">
                <AdminInput label="제목(alt)" value={bTitle} onChange={setBTitle} />
                <AdminInput label="클릭 링크(URL)" value={bLinkUrl} onChange={setBLinkUrl} placeholder="/my/membership" />

                <div>
                  <div className="text-[12px] font-bold text-white/55">배너 이미지</div>
                  <label
                    className={`mt-2 block cursor-pointer rounded-2xl border border-dashed p-4 transition-colors ${
                      bannerDragOver
                        ? "border-panana-pink bg-panana-pink/10"
                        : "border-white/15 bg-black/15 hover:bg-black/20"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setBannerDragOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setBannerDragOver(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setBannerDragOver(false);
                      const file = e.dataTransfer?.files?.[0];
                      if (file?.type.startsWith("image/")) onBannerImageUpload(file);
                    }}
                  >
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onBannerImageUpload(file);
                      }}
                    />
                    <div className="text-[12px] font-extrabold text-white/70">
                      {bannerDragOver ? "여기에 놓기" : "클릭 또는 드래그하여 이미지 업로드"}
                    </div>
                    {banner.image_url ? (
                      <div className="mt-3 flex justify-center overflow-auto rounded-xl border border-white/10 bg-white/[0.02] p-2">
                        <div className="relative h-[260px] w-[110px] shrink-0">
                          <Image
                            src={banner.image_url}
                            alt={banner.title || "membership banner"}
                            fill
                            className="object-contain object-top"
                            sizes="110px"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl bg-white/5 p-4 text-[12px] font-semibold text-white/45">이미지 미등록</div>
                    )}
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <AdminButton onClick={saveBanner} disabled={bannerSaving}>
                    {bannerSaving ? "저장 중..." : "배너 저장"}
                  </AdminButton>
                  <AdminButton variant="danger" onClick={deleteBanner} disabled={bannerSaving}>
                    삭제
                  </AdminButton>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-[12px] font-semibold text-white/45">등록된 배너가 없어요.</p>
                <div className="mt-3">
                  <AdminButton onClick={addBanner} disabled={bannerSaving}>
                    {bannerSaving ? "추가 중..." : "배너 추가"}
                  </AdminButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}
