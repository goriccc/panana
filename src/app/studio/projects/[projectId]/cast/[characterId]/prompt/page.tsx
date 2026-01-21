import { PromptEditorClient } from "@/app/studio/characters/[id]/prompt/ui";

export default function ProjectCharacterPromptPage({
  params,
  searchParams,
}: {
  params: { projectId: string; characterId: string };
  searchParams?: { tab?: string };
}) {
  // 캐릭터 단위 데이터는 characterId로 관리 (프로젝트 컨텍스트는 헤더/스토어에서 별도 관리)
  return <PromptEditorClient characterId={params.characterId} initialTab={searchParams?.tab} />;
}

