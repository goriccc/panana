export type StudioProject = {
  id: string;
  title: string; // 세계관/작품명
  subtitle?: string; // 장르/톤 등
  updatedAt: string;
};

export type StudioCastMember = {
  id: string;
  projectId: string;
  name: string;
  roleLabel: string; // 주인공/서브/악역 등
  status: "draft" | "published";
  updatedAt: string;
};

export type StudioScene = {
  id: string;
  projectId: string;
  title: string;
  episodeLabel: string; // EP1, EP2...
  updatedAt: string;
};

// NOTE: Studio는 DB 기반으로 동작합니다. 더미 데이터는 혼동/오류(예: uuid 필드에 문자열 저장)를 유발하므로 비웁니다.
export const studioProjects: StudioProject[] = [];

export const studioCast: StudioCastMember[] = [];

export const studioScenes: StudioScene[] = [];

export function getProject(projectId: string) {
  return studioProjects.find((p) => p.id === projectId) ?? null;
}

export function getCast(projectId: string) {
  return studioCast.filter((c) => c.projectId === projectId);
}

export function getCastMember(projectId: string, characterId: string) {
  return studioCast.find((c) => c.projectId === projectId && c.id === characterId) ?? null;
}

export function getScenes(projectId: string) {
  return studioScenes.filter((s) => s.projectId === projectId);
}

