import { AdminAuthGate } from "./_components/AdminAuthGate";
import { DashboardStatsClient } from "./_components/DashboardStatsClient";

export default function AdminDashboardPage() {
  return (
    <AdminAuthGate>
      <div>
        <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">대시보드</div>
        <div className="mt-2 text-[13px] font-semibold leading-[1.5] text-white/45">
          유입·계정·입국심사·대화·캐릭터·이미지생성 통계를 확인합니다.
        </div>
        <div className="mt-6">
          <DashboardStatsClient />
        </div>
      </div>
    </AdminAuthGate>
  );
}
