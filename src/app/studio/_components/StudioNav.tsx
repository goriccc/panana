"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const nav = [
  { href: "/studio", label: "대시보드", icon: "home" as const },
  { href: "/studio/projects", label: "프로젝트", icon: "stack" as const },
  { href: "/studio/characters", label: "캐릭터 관리", icon: "bot" as const },
  { href: "/studio/analytics", label: "통계/분석", icon: "chart" as const },
];

function Icon({ name }: { name: "home" | "bot" | "chart" | "stack" }) {
  if (name === "home") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1v-9.5Z"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="2"
          strokeLinejoin="round"
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
  if (href === "/studio") return pathname === "/studio";
  return pathname.startsWith(href);
}

export function StudioSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[64px] shrink-0 border-r border-white/10 bg-white/[0.02]">
      <div className="flex h-14 items-center justify-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
          <span className="text-[12px] font-extrabold text-white/80">P</span>
        </div>
      </div>
      <nav className="mt-2 flex flex-col gap-2 px-2">
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
    </aside>
  );
}

