"use client";

import { useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export function AdminHeader() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    void supabase.auth.signOut();
  };

  return (
    <>
      <header className="mb-4 flex items-center justify-end">
        <button
          type="button"
          className="rounded-xl border border-white/5 bg-white/[0.06] px-4 py-2.5 text-[13px] font-extrabold text-white/80 ring-1 ring-white/10 hover:bg-white/[0.08]"
          onClick={() => setShowLogoutConfirm(true)}
        >
          로그아웃
        </button>
      </header>

      {showLogoutConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowLogoutConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0f12] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="logout-dialog-title" className="text-[15px] font-bold text-white/90">
              로그아웃
            </h2>
            <p className="mt-2 text-[13px] text-white/60">
              정말 로그아웃 하시겠습니까?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[13px] font-semibold text-white/80 hover:bg-white/[0.08]"
                onClick={() => setShowLogoutConfirm(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-[#4F7CFF] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#3E6BFF]"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
