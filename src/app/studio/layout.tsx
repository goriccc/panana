"use client";

import { StudioHeader } from "./_components/StudioHeader";
import { StudioSidebar } from "./_components/StudioNav";
import { AdminAuthGate } from "@/app/admin/_components/AdminAuthGate";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGate hideLogoutButton>
      <div className="studio-scope min-h-dvh bg-[radial-gradient(900px_480px_at_40%_0%,rgba(140,170,255,0.12),transparent_60%),linear-gradient(#070A10,#07070B)] font-sans text-white">
        <div className="flex min-h-dvh">
          <StudioSidebar />

          <div className="min-w-0 flex-1">
            <StudioHeader />

            <main className="mx-auto w-full max-w-[1200px] px-6 py-6">{children}</main>
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}

