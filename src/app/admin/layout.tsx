import Link from "next/link";
import "./admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-scope min-h-dvh bg-[#07070B] font-sans text-white">
      <div className="mx-auto flex w-full max-w-[1200px] gap-6 px-6 py-8">
        <aside className="w-fit shrink-0">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[14px] font-extrabold tracking-[-0.01em] text-white/90">
              Panana Admin
            </div>
            <div className="mt-1 text-[12px] font-semibold text-white/40">콘텐츠/테스트/결제 관리</div>
          </div>

          <nav className="mt-4 space-y-2">
            {[
              { href: "/admin", label: "대시보드" },
              { href: "/admin/categories", label: "카테고리" },
              { href: "/admin/characters", label: "캐릭터" },
              { href: "/admin/notices", label: "공지사항" },
              { href: "/admin/billing", label: "충전 상품" },
              { href: "/admin/membership", label: "멤버십" },
              { href: "/admin/llm", label: "LLM 설정" },
              { href: "/admin/site", label: "사이트(푸터/SEO)" },
              { href: "/admin/scene-image", label: "장면 이미지" },
              { href: "/admin/menu", label: "메뉴관리" },
              { href: "/admin/recommendation", label: "추천(개인화)" },
              { href: "/studio", label: "PananaAI Studio" },
            ].map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="block whitespace-nowrap rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-[13px] font-semibold text-white/70 hover:bg-white/[0.04]"
              >
                {i.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="mb-4 flex items-center justify-between">
            <div className="text-[16px] font-extrabold tracking-[-0.01em] text-white/90">
              관리자
            </div>
            <div className="text-[12px] font-semibold text-white/35">Supabase 연동 (RLS/공개 뷰 기반)</div>
          </header>

          <main className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

