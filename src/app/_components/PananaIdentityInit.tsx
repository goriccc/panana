"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { ensurePananaIdentity, isValidPananaHandle, setPananaHandle, setPananaId, setPananaNickname } from "@/lib/pananaApp/identity";
import { fetchIdentityThrottled } from "@/lib/pananaApp/identityApi";

export function PananaIdentityInit() {
  const { data: session, status, update } = useSession();
  const didSyncForAuthRef = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      didSyncForAuthRef.current = false;
      return;
    }
    if (status !== "authenticated") return;
    if (didSyncForAuthRef.current) return;
    didSyncForAuthRef.current = true;

    const idt = ensurePananaIdentity();

    (async () => {
      try {
        const data = await fetchIdentityThrottled(idt.id);
        if (!data) {
          didSyncForAuthRef.current = false;
          return;
        }
        const sid = data.id;
        const sh = data.handle;
        const sn = data.nickname;
        if (sid) setPananaId(sid);
        if (isValidPananaHandle(sh)) setPananaHandle(sh);
        if (sn) setPananaNickname(sn);

        const cur = String((session as any)?.pananaHandle || "").trim().toLowerCase();
        if (!isValidPananaHandle(cur) || cur !== sh) {
          await update({ pananaHandle: sh, pananaId: sid, pananaNickname: sn } as any);
        }
      } catch {
        didSyncForAuthRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return null;
}

