"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function TopBar({
  title,
  backHref,
  right,
}: {
  title: string;
  backHref: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const [safetyOn, setSafetyOn] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const v = document.cookie.split("; ").find((row) => row.startsWith("panana_safety_on="));
        setSafetyOn(v ? v.split("=")[1] === "1" : localStorage.getItem("panana_safety_on") === "1");
      } catch {
        setSafetyOn(false);
      }
    };
    read();
    window.addEventListener("panana-safety-change", read as EventListener);
    return () => window.removeEventListener("panana-safety-change", read as EventListener);
  }, []);

  const headerAccent = safetyOn ? "text-panana-pink2" : "text-[#ffa9d6]";
  return (
    <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
      <div className="relative flex h-11 items-center">
        <Link
          href={backHref}
          aria-label="뒤로가기"
          className={`absolute left-0 p-2 ${headerAccent}`}
          prefetch={true}
          onMouseEnter={() => router.prefetch(backHref)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="stroke-current">
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <div className={`mx-auto text-[18px] font-semibold tracking-[-0.01em] ${headerAccent}`}>
          {title}
        </div>

        {right ? <div className="absolute right-0">{right}</div> : null}
      </div>
    </header>
  );
}

