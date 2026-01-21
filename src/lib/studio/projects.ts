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

export const studioProjects: StudioProject[] = [
  { id: "romance-drama", title: "로판남주", subtitle: "드라마형/씬 진행", updatedAt: "2026-01-21" },
  { id: "modern-chat", title: "현대 캐릭터팩", subtitle: "1:1 중심", updatedAt: "2026-01-20" },
];

export const studioCast: StudioCastMember[] = [
  { id: "guide", projectId: "romance-drama", name: "가이드", roleLabel: "남주", status: "draft", updatedAt: "2026-01-21" },
  { id: "emperor", projectId: "romance-drama", name: "황제", roleLabel: "적대", status: "draft", updatedAt: "2026-01-19" },
  { id: "knight", projectId: "romance-drama", name: "기사단장", roleLabel: "서브", status: "published", updatedAt: "2026-01-18" },
  { id: "seol-a", projectId: "modern-chat", name: "김설아", roleLabel: "친구", status: "published", updatedAt: "2026-01-20" },
];

export const studioScenes: StudioScene[] = [
  { id: "ep1", projectId: "romance-drama", title: "첫 만남", episodeLabel: "EP1", updatedAt: "2026-01-21" },
  { id: "ep2", projectId: "romance-drama", title: "가면무도회", episodeLabel: "EP2", updatedAt: "2026-01-20" },
];

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

