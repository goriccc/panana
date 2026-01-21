import Link from "next/link";

export function ContentCard({
  author,
  title,
  description,
  tags,
  href,
}: {
  author: string;
  title: string;
  description: string;
  tags: string[];
  href?: string;
}) {
  const body = (
    <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.35)]">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-none bg-[radial-gradient(900px_320px_at_30%_20%,rgba(255,77,167,0.22),transparent_55%),radial-gradient(700px_280px_at_70%_70%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />

      <div className="mt-3 text-[12px] font-semibold text-white/45">{author}</div>
      <div className="mt-1 text-[14px] font-bold tracking-[-0.01em] text-white/85">{title}</div>
      <div className="mt-1 line-clamp-2 text-[12px] leading-[1.45] text-white/55">{description}</div>

      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-semibold text-[#ffa9d6]">
        {tags.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}