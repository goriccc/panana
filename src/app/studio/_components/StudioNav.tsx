"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { StudioConfirmDialog } from "@/app/studio/_components/StudioDialogs";

const nav = [
  // 실사용 플로우 기준: 프로젝트 → 캐릭터 → Import
  { href: "/studio/projects", label: "프로젝트", icon: "stack" as const },
  { href: "/studio/import", label: "Import", icon: "upload" as const },
  // 통계/분석은 아직 구현되지 않으므로 노출하지 않음(혼란/신뢰 저하 방지)
  // { href: "/studio/analytics", label: "통계/분석", icon: "chart" as const },
];

function Icon({ name }: { name: "bot" | "chart" | "stack" | "upload" | "logout" }) {
  if (name === "upload") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 16V4"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M7 9l5-5 5 5"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 20h16"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 19V5" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 19V11" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 19V8" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" />
        <path d="M16 19V13" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 19V6" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "stack") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 4l9 5-9 5-9-5 9-5Z"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M21 12l-9 5-9-5"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M21 16l-9 5-9-5"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "logout") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M10 17l-1.4-1.4L12.2 12 8.6 8.4 10 7l5 5-5 5Z"
          fill="rgba(255,255,255,0.75)"
        />
        <path
          d="M4 4h7"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M4 20h7"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M4 4v16"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M8 10h8M8 14h6" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M12 2c5.523 0 10 3.134 10 7v6c0 3.866-4.477 7-10 7S2 18.866 2 15V9c0-3.866 4.477-7 10-7Z"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  return pathname.startsWith(href);
}

export function StudioSidebar() {
  const pathname = usePathname();
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <aside className="flex w-[64px] shrink-0 flex-col border-r border-white/10 bg-white/[0.02]">
      <nav className="mt-2 flex flex-1 flex-col gap-2 px-2">
        {nav.map((i) => {
          const active = isActive(pathname, i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "group flex h-11 w-full items-center justify-center rounded-xl bg-white/[0.02] ring-1 ring-white/5 hover:bg-white/[0.04]",
                active ? "bg-white/[0.06] ring-white/15" : ""
              )}
              aria-label={i.label}
              title={i.label}
            >
              <Icon name={i.icon} />
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-3">
        <button
          type="button"
          className={cn(
            "group flex h-11 w-full items-center justify-center rounded-xl bg-white/[0.02] ring-1 ring-white/5 hover:bg-white/[0.04]",
            "text-white/70"
          )}
          aria-label="로그아웃"
          title="로그아웃"
          onClick={() => setLogoutOpen(true)}
          disabled={busy}
        >
          <Icon name="logout" />
        </button>
      </div>

      <StudioConfirmDialog
        open={logoutOpen}
        title="로그아웃할까요?"
        description="Studio에서 로그아웃합니다."
        confirmText="로그아웃"
        cancelText="취소"
        destructive
        busy={busy}
        onClose={() => {
          if (busy) return;
          setLogoutOpen(false);
        }}
        onConfirm={async () => {
          setBusy(true);
          try {
            await supabase.auth.signOut();
          } finally {
            setBusy(false);
            setLogoutOpen(false);
          }
        }}
      />
    </aside>
  );
}

