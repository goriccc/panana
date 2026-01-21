import { TriggerBuilderClient } from "@/app/studio/characters/[id]/triggers/ui";

export default function ProjectCharacterTriggersPage({ params }: { params: { projectId: string; characterId: string } }) {
  return <TriggerBuilderClient characterId={params.characterId} />;
}

