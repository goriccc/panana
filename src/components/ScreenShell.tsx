import { PropsWithChildren } from "react";

export function ScreenShell({
  title,
  rightAction,
  titleClassName = "text-panana-pink/90",
  children,
}: PropsWithChildren<{
  title?: string;
  rightAction?: React.ReactNode;
  titleClassName?: string;
}>) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.22),transparent_60%),radial-gradient(900px_520px_at_50%_110%,rgba(255,77,167,0.12),transparent_55%),linear-gradient(#06070A,#0B0C10)] px-5 pb-28 pt-10 text-white">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="relative mb-7">
          {title ? (
            <div className={`text-center text-[18px] font-semibold tracking-[-0.01em] ${titleClassName}`}>
              {title}
            </div>
          ) : null}
          {rightAction ? (
            <div className="absolute right-0 top-0">{rightAction}</div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

