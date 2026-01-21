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
        "relative h-7 w-12 rounded-full transition-colors",
        checked ? "bg-panana-pink" : "bg-white/15",
      ].join(" ")}
    >
      <span
        className={[
          "absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

