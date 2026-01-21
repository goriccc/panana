import { TriggerBuilderClient } from "./ui";

export default function TriggersPage({ params }: { params: { id: string } }) {
  return <TriggerBuilderClient characterId={params.id} />;
}

