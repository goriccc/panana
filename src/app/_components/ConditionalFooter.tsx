"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/Footer";

export function ConditionalFooter() {
  const pathname = usePathname() || "";
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/studio") ||
    pathname.startsWith("/airport/chat") ||
    (pathname.startsWith("/c/") && pathname.includes("/chat"))
  ) {
    return null;
  }
  return <Footer />;
}

