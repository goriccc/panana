"use client";

import { useEffect } from "react";

const VISITOR_COOKIE = "panana_visitor_id";
const VISIT_SENT_KEY = "panana_visit_sent";
const COOKIE_MAX_AGE_DAYS = 365 * 2;

function getVisitorId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(^| )${VISITOR_COOKIE}=([^;]+)`));
  if (match?.[2]) return match[2];
  const id = crypto.randomUUID?.() ?? `v_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  document.cookie = `${VISITOR_COOKIE}=${id}; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 24 * 60 * 60}; SameSite=Lax`;
  return id;
}

/**
 * 앱 로드 시 한 번만 /api/visit 호출 (세션당 1회)
 * - visitor_id 쿠키로 유니크 유입수 집계
 * - sessionStorage로 같은 탭에서 중복 호출 방지
 */
export function VisitTracker() {
  useEffect(() => {
    try {
      if (typeof sessionStorage === "undefined") return;
      if (sessionStorage.getItem(VISIT_SENT_KEY)) return;

      const visitorId = getVisitorId();
      const params = new URLSearchParams({ visitor_id: visitorId });

      fetch(`/api/visit?${params}`, { method: "GET", keepalive: true }).finally(() => {
        try {
          sessionStorage.setItem(VISIT_SENT_KEY, "1");
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  }, []);

  return null;
}
