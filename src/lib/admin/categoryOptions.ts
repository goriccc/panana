export type AdminCategoryOption = {
  id: string;
  slug: string;
  title: string;
};

// NOTE: 현재는 더미. 추후 Supabase `categories` 테이블로 대체.
export const adminCategoryOptions: AdminCategoryOption[] = [
  { id: "cat-1", slug: "for-me", title: "나에게 맞는" },
  { id: "cat-2", slug: "new", title: "새로 올라온" },
  { id: "cat-3", slug: "loved", title: "모두에게 사랑받는" },
];

