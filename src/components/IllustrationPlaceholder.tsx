export function IllustrationPlaceholder({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(800px_300px_at_40%_30%,rgba(255,77,167,0.25),transparent_60%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]",
        className,
      ].join(" ")}
      aria-label={label}
    >
      <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_25%,rgba(255,255,255,0.15),transparent_40%),radial-gradient(circle_at_70%_65%,rgba(255,255,255,0.10),transparent_45%)]" />
      <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold tracking-[-0.01em] text-white/85">
        {label}
      </div>
      <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-panana-pink/25 blur-2xl" />
      <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
    </div>
  );
}

