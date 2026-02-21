"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function Switch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  // 첫 페인트 후에만 transition 적용 → 홈 복귀 시 슬라이더가 OFF→ON으로 슬라이딩되지 않도록
  const [transitionOn, setTransitionOn] = useState(false);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const id = requestAnimationFrame(() => setTransitionOn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={[
        "relative h-5 w-11 rounded-full transition-colors",
        !checked && "bg-white/15",
      ].join(" ")}
      style={
        checked
          ? { backgroundColor: "color-mix(in srgb, var(--panana-pink2) 55%, rgba(255,255,255,0.12))" }
          : undefined
      }
    >
      <span
        className={[
          "absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full",
          transitionOn && "transition-transform",
          checked ? "translate-x-[26px] bg-panana-pink2" : "translate-x-1 bg-white",
        ].join(" ")}
      />
    </button>
  );
}

