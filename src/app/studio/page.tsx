import Link from "next/link";

export default function StudioDashboardPage() {
  return (
    <div>
      <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">대시보드</div>
      <div className="mt-2 text-[13px] font-semibold text-white/45">
        작품(프로젝트) 단위로 캐스트(캐릭터)와 씬(드라마)을 구성하고, 캐릭터의 프롬프트/로어북/트리거를 관리하는 제작자용 콘솔입니다.
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
          href="/studio/import"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
        >
          <div className="text-[14px] font-extrabold text-white/85">Import</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">마크다운/CSV로 프롬프트·로어북·트리거를 빠르게 적용</div>
        </Link>
        <Link
          href="/studio/projects"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.05]"
        >
          <div className="text-[14px] font-extrabold text-white/85">캐스트 편집</div>
          <div className="mt-1 text-[12px] font-semibold text-white/40">프로젝트를 선택한 뒤 캐스트에서 캐릭터를 편집</div>
        </Link>
      </div>
    </div>
  );
}

