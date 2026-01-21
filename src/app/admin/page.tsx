export default function AdminDashboardPage() {
  return (
    <div>
      <div className="text-[18px] font-extrabold tracking-[-0.01em] text-white/90">대시보드</div>
      <div className="mt-2 text-[13px] font-semibold leading-[1.5] text-white/45">
        여기서 홈 카드/카테고리/캐릭터/공지/결제/멤버십/공항 플로우를 관리합니다. (현재는 UI만 구현되어 있고,
        데이터는 Supabase로 연결될 예정입니다.)
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "홈/카테고리", desc: "홈 상단 카드, 카테고리명/정렬, 카드 노출(2x2)" },
          { title: "캐릭터", desc: "프로필/게시물/추천 섹션/메시지 버튼 연결" },
          { title: "공지사항", desc: "리스트/상세, 노출 여부, 게시 일정" },
          { title: "충전 상품", desc: "가격, 파나나 수량, 보너스, 추천 배지" },
          { title: "멤버십", desc: "혜택/가격/CTA/약관 링크" },
          { title: "공항 플로우", desc: "시작 문구/질문/건너뛰기 문구/완료 화면" },
        ].map((c) => (
          <div key={c.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-[14px] font-extrabold text-white/85">{c.title}</div>
            <div className="mt-1 text-[12px] font-semibold text-white/45">{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

