import { PropsWithChildren } from "react";

type Variant = "system" | "user";

export function ChatBubble({
  variant,
  children,
  className = "",
}: PropsWithChildren<{ variant: Variant; className?: string }>) {
  const base =
    "max-w-[320px] rounded-2xl px-4 py-3 text-[15px] leading-[1.4] tracking-[-0.01em]";

  if (variant === "user") {
    return (
      <div className={`ml-auto ${className}`}>
        <div className={`${base} bg-panana-pink text-[#1A0B14] shadow-[0_10px_30px_rgba(255,77,167,0.25)]`}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={`mr-auto ${className}`}>
      <div className={`${base} bg-white/[0.06] text-white/85 shadow-[0_10px_30px_rgba(0,0,0,0.35)]`}>
        {children}
      </div>
    </div>
  );
}

