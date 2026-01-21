import Image from "next/image";
import Link from "next/link";

export function HomeHeader() {
  return (
    <div className="mx-auto w-full max-w-[420px] px-5 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/panana.png"
            alt="Panana"
            width={86}
            height={22}
            priority
            quality={100}
            className="h-auto w-[86px] select-none"
          />
        </div>
        <Link href="/my" aria-label="메뉴" className="p-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 7h16" stroke="rgba(255,77,167,0.95)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M4 12h16" stroke="rgba(255,77,167,0.95)" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M4 17h16" stroke="rgba(255,77,167,0.95)" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" className="rounded-full bg-panana-pink px-4 py-2 text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(255,77,167,0.18)]">
          홈
        </button>
        <button type="button" className="rounded-full bg-white/5 px-4 py-2 text-[12px] font-semibold text-white/70 ring-1 ring-white/10">
          도전모드
        </button>
        <button type="button" className="rounded-full bg-white/5 px-4 py-2 text-[12px] font-semibold text-white/70 ring-1 ring-white/10">
          랭킹
        </button>
      </div>
    </div>
  );
}