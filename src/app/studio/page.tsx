import Link from "next/link";

export default function StudioDashboardPage() {
  return (
    <div>
      <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">대시보드</div>
      <div className="mt-2 text-[13px] font-semibold text-white/45">
        캐릭터 프롬프트(3-Layer), 로어북, 오서 노트, 변수 트리거를 관리하는 제작자용 콘솔입니다.
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Link
          href="/studio/projects"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
        >
          <div className="text-[14px] font-extrabold text-white/85">프로젝트(세계관)</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">프로젝트 → 캐스트 → 씬/시뮬레이터</div>
        </Link>
        <Link
          href="/studio/characters/guide/prompt?tab=lorebook"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
        >
          <div className="text-[14px] font-extrabold text-white/85">로어북</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">검색/필터/페이지네이션 + 언락 조건</div>
        </Link>
        <Link
          href="/studio/characters/guide/triggers"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
        >
          <div className="text-[14px] font-extrabold text-white/85">변수 트리거</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">IF-THEN 노코드 규칙 빌더</div>
        </Link>
      </div>
    </div>
  );
}

