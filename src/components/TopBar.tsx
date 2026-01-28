import Link from "next/link";
import { useRouter } from "next/navigation";

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
  return (
    <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
      <div className="relative flex h-11 items-center">
        <Link 
          href={backHref} 
          aria-label="뒤로가기" 
          className="absolute left-0 p-2"
          prefetch={true}
          onMouseEnter={() => router.prefetch(backHref)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M15 6l-6 6 6 6"
              stroke="rgba(255,169,214,0.98)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <div className="mx-auto text-[18px] font-semibold tracking-[-0.01em] text-[#ffa9d6]">
          {title}
        </div>

        {right ? <div className="absolute right-0">{right}</div> : null}
      </div>
    </header>
  );
}

