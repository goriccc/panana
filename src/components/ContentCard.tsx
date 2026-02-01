"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function ContentCard({
  author,
  title,
  description,
  tags,
  href,
  imageUrl,
  onClick,
  priority,
}: {
  author: string;
  title: string;
  description: string;
  tags: string[];
  href?: string;
  imageUrl?: string;
  onClick?: () => void;
  /** 브라우저 우선 로드(fetchpriority=high) */
  priority?: boolean;
}) {
  const router = useRouter();

  const body = (
    <div className="flex h-[280px] flex-col rounded-[8px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.35)]">
      <div className="relative h-[141px] w-full shrink-0 overflow-hidden rounded-none bg-[radial-gradient(900px_320px_at_30%_20%,rgba(255,77,167,0.22),transparent_55%),radial-gradient(700px_280px_at_70%_70%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            fetchPriority={priority ? "high" : undefined}
            loading={priority ? "eager" : "lazy"}
          />
        ) : null}
      </div>

      <div className="mt-3 h-[14px] shrink-0 text-[12px] font-semibold text-white/45 leading-[14px]">{author}</div>
      <div className="mt-1 h-[20px] shrink-0 line-clamp-1 text-[14px] font-bold leading-[20px] tracking-[-0.01em] text-white/85">{title}</div>
      <div className="mt-1 h-[34.8px] shrink-0 flex items-start text-[12px] leading-[1.45] text-white/55">
        <div className="line-clamp-2">{description}</div>
      </div>

      <div className="mt-2 h-[18px] shrink-0 overflow-hidden">
        <div className="flex flex-nowrap gap-x-2 text-[12px] font-semibold leading-[18px] text-[#ffa9d6]">
          {tags.slice(0, 2).map((t) => (
            <span key={t} className="max-w-[10rem] truncate">
              {t}
            </span>
          ))}
          {tags.length > 2 ? <span className="shrink-0 text-[#ffa9d6]/70">+{tags.length - 2}</span> : null}
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link 
      href={href}
      prefetch={true}
      onMouseEnter={() => href && router.prefetch(href)}
      onClick={onClick}
    >
      {body}
    </Link>
  ) : body;
}