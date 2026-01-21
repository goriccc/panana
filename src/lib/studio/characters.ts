export type StudioCharacterSummary = {
  id: string;
  name: string;
  genre: string;
  status: "draft" | "published";
  updatedAt: string; // ISO date
};

export const studioCharacters: StudioCharacterSummary[] = [
  { id: "guide", name: "가이드", genre: "로판남주", status: "draft", updatedAt: "2026-01-21" },
  { id: "seol-a", name: "김설아", genre: "현대", status: "published", updatedAt: "2026-01-20" },
  { id: "gyemnam", name: "가족자것입은게겐남", genre: "코미디", status: "draft", updatedAt: "2026-01-18" },
];

