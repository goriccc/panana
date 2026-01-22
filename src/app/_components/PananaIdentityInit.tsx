"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { ensurePananaIdentity, isValidPananaHandle, setPananaHandle, setPananaId, setPananaNickname } from "@/lib/pananaApp/identity";

export function PananaIdentityInit() {
  const { data: session, status, update } = useSession();

  useEffect(() => {
    // 1) 접속만 해도 로컬 고유번호 생성
    const idt = ensurePananaIdentity();

    // 2) 서버에서 UNIQUE 보장 handle 발급/조회 + (로그인 시) 소셜 매핑
    (async () => {
      try {
        const res = await fetch("/api/me/identity", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pananaId: idt.id }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) return;

        const sid = String(data.id || "").trim();
        const sh = String(data.handle || "").trim().toLowerCase();
        const sn = String(data.nickname || "").trim();
        if (sid) setPananaId(sid);
        if (isValidPananaHandle(sh)) setPananaHandle(sh);
        if (sn) setPananaNickname(sn);

        // 3) 로그인된 경우: 세션(JWT)에 매핑값 저장(다른 기기에서도 동일 handle로 매칭 가능)
        if (status === "authenticated") {
          const cur = String((session as any)?.pananaHandle || "").trim().toLowerCase();
          if (!isValidPananaHandle(cur) || cur !== sh) {
            await update({ pananaHandle: sh, pananaId: sid, pananaNickname: sn } as any);
          }
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return null;
}

