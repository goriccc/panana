"use client";

export function Switch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={[
        // 스샷 토글 형태: 얇은 트랙 + 작은 노브(핑크)
        "relative h-5 w-11 rounded-full transition-colors",
        checked ? "bg-[#ffa1cc]/35" : "bg-white/15",
      ].join(" ")}
    >
      <span
        className={[
          "absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-transform",
          checked ? "translate-x-[26px] bg-[#ffa1cc]" : "translate-x-1 bg-white",
        ].join(" ")}
      />
    </button>
  );
}

