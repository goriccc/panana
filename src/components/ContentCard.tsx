"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** 공백/콤마로 이어진 한 덩어리 문자열도 개별 태그 배열로 통일 (admin 저장 형식 차이 대응) */
function normalizeTagsToArray(tags: string[] | string | undefined | null): string[] {
  if (tags == null) return [];
  const raw = Array.isArray(tags) ? tags : [tags];
  const out: string[] = [];
  for (const t of raw) {
    const s = String(t ?? "").trim();
    if (!s) continue;
    const parts = s.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) {
      out.push(p.startsWith("#") ? p : `#${p}`);
    }
  }
  return out;
}

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
  const tagsArr = normalizeTagsToArray(tags);

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

      <div className="mt-3 h-[20px] shrink-0 line-clamp-1 text-[14px] font-bold leading-[20px] tracking-[-0.01em] text-white/85">{title}</div>
      <div className="mt-1 h-[52px] shrink-0 flex items-start text-[12px] leading-[1.45] text-white/55">
        <div className="line-clamp-3">{description}</div>
      </div>

      <div className="mt-2 flex h-[18px] w-full shrink-0 items-center gap-2 text-[12px] font-semibold leading-[18px] text-panana-pink2">
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 gap-x-2 overflow-hidden">
            {tagsArr.slice(0, 2).map((t) => (
              <span key={t} className="min-w-0 truncate">
                {t}
              </span>
            ))}
          </div>
        </div>
        {tagsArr.length > 2 ? (
          <span
            className="flex h-full w-8 flex-shrink-0 items-center justify-end"
            style={{ color: "color-mix(in srgb, var(--panana-pink2, #FFA1CC) 70%, transparent)" }}
            aria-hidden
          >
            +{tagsArr.length - 2}
          </span>
        ) : null}
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