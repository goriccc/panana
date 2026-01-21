"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Switch } from "@/components/Switch";

export function NotificationsClient() {
  const [marketing, setMarketing] = useState(true);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.10),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <TopBar title="알림설정" backHref="/my" />

      <main className="mx-auto w-full max-w-[420px] px-0 pb-16 pt-2">
        <div className="border-t border-white/10">
          <div className="flex items-center justify-between gap-4 px-5 py-5">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-white/80">마케팅 알림 수신 동의</div>
              <div className="mt-1 text-[11px] font-semibold text-white/35">
                가입하신 정보로 파나나의 새소식과 이벤트를 알려드려요.
              </div>
            </div>
            <Switch checked={marketing} onChange={setMarketing} ariaLabel="마케팅 알림 수신 동의" />
          </div>
          <div className="border-b border-white/10" />
        </div>
      </main>
    </div>
  );
}

