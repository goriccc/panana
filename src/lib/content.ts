export type ContentCardItem = {
  id: string;
  characterSlug: string;
  author: string;
  title: string;
  description: string;
  tags: string[];
  imageUrl?: string;
  // 스파이시 지원 캐릭터(성인 대화 가능) 여부. 홈 스파이시 토글(ON) 시 필터링에 사용.
  safetySupported?: boolean;
  gender?: "male" | "female" | null;
};

export type Category = {
  slug: string;
  name: string;
  items: ContentCardItem[];
};

const demoItems: ContentCardItem[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `spinner-${i + 1}`,
  characterSlug: "seola",
  author: "@spinner",
  title: "여사친 김설아",
  description: "오랜 소꿉친구에게 갑자기 크리스마스에 고백을 해버렸는데...",
  tags: ["#여사친", "#고백공격"],
  safetySupported: true,
  gender: "female",
}));

export const categories: Category[] = [
  { slug: "for-you", name: "나에게 맞는", items: demoItems.slice(0, 6) },
  { slug: "new", name: "새로 올라온", items: demoItems.slice(2, 10) },
  { slug: "popular", name: "모두에게 사랑받는", items: demoItems.slice(1, 9) },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}