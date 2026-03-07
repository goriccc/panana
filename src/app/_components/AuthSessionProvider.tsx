"use client";

import { SessionProvider } from "next-auth/react";

// refetchInterval=0이어도 next-auth가 주기 호출할 수 있으므로 24시간으로 설정
const REFETCH_INTERVAL_SEC = 60 * 60 * 24;

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={REFETCH_INTERVAL_SEC}
      refetchOnWindowFocus={false}
    >
      {children}
    </SessionProvider>
  );
}

