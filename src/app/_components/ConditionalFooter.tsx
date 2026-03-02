"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Footer } from "@/components/Footer";

export function ConditionalFooter() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const homeTab = pathname === "/home" ? searchParams.get("tab") : null;
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/airport") ||
    pathname.startsWith("/adult") ||
    pathname.startsWith("/challenge/") ||
    pathname.startsWith("/my/") || // 마이 1뎁스(/my) 제외 하위 뎁스에서 푸터 숨김
    (pathname === "/home" && homeTab === "challenge") ||
    (pathname.startsWith("/c/") && pathname.includes("/chat")) ||
    pathname.match(/^\/c\/[^/]+$/) // 캐릭터 상세(/c/[slug])에서 푸터 숨김
  ) {
    return null;
  }
  return <Footer />;
}

