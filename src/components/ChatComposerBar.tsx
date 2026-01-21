export function ChatComposerBar({ placeholder = "입력을 하려면 터치!" }: { placeholder?: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="mx-auto w-full max-w-[420px] px-5">
        <div className="flex items-center gap-3 rounded-full border border-panana-pink/30 bg-white/[0.05] px-4 py-3 backdrop-blur">
          <div className="flex-1 text-[14px] text-white/35">{placeholder}</div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/10">
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 12h12"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M13 5l7 7-7 7"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

