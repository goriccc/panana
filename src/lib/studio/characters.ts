export type StudioCharacterSummary = {
  id: string;
  name: string;
  genre: string;
  status: "draft" | "published";
  updatedAt: string; // ISO date
};

// NOTE: Studio는 DB 기반으로 동작합니다. 더미 데이터는 혼동을 유발하므로 비웁니다.
export const studioCharacters: StudioCharacterSummary[] = [];

