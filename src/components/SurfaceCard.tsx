import { PropsWithChildren } from "react";

export function SurfaceCard({
  children,
  className = "",
  variant = "default",
}: PropsWithChildren<{ className?: string; variant?: "default" | "outglow" }>) {
  const isOutglow = variant === "outglow";
  return (
    <div className="relative">
      {isOutglow ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[2px] z-0 rounded-[26px] shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_0_16px_3px_rgba(255,255,255,0.55)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[1px] z-0 rounded-[25px] shadow-[0_0_10px_1px_rgba(255,255,255,0.35)]"
          />
        </>
      ) : null}

      <div
        className={[
          "relative z-10 rounded-3xl border bg-panana-card/90 shadow-glow backdrop-blur",
          isOutglow
            ? "border-transparent shadow-[0_18px_55px_rgba(0,0,0,0.55)]"
            : "",
          !isOutglow ? "border-panana-border" : "",
          className,
        ].join(" ")}
      >
        <div>{children}</div>
      </div>
    </div>
  );
}

