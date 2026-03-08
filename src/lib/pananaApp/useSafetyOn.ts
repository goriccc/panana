"use client";

import { useEffect, useState } from "react";

function readSafetyOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = document.cookie.split("; ").find((row) => row.startsWith("panana_safety_on="));
    return v ? v.split("=")[1] === "1" : localStorage.getItem("panana_safety_on") === "1";
  } catch {
    return false;
  }
}

/**
 * 클라이언트에서 panana_safety_on(cookie + localStorage) 값을 구독합니다.
 * panana-safety-change 이벤트 발생 시 자동 갱신됩니다.
 */
export function useSafetyOn(): boolean {
  const [safetyOn, setSafetyOn] = useState(false);

  useEffect(() => {
    const read = () => setSafetyOn(readSafetyOn());
    read();
    window.addEventListener("panana-safety-change", read as EventListener);
    return () => window.removeEventListener("panana-safety-change", read as EventListener);
  }, []);

  return safetyOn;
}

/** 동기 읽기 전용 (이벤트 구독 없음). 컴포넌트 밖/서버에서는 사용하지 말 것. */
export function getSafetyOnSync(): boolean {
  return readSafetyOn();
}
