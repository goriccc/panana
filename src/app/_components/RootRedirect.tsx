"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 루트(/) 접속 시 /airport로 이동.
 * 서버는 200 + OG 메타가 포함된 HTML을 반환하고, 클라이언트에서만 리다이렉트하여
 * 링크 미리보기(오픈 그래프)가 https://panana.kr/ 에서도 정상 표시되도록 함.
 */
export function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/airport");
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="text-neutral-400">이동 중...</p>
    </div>
  );
}
