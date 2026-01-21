import { PromptEditorClient } from "./ui";

export default function PromptEditorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string };
}) {
  return <PromptEditorClient characterId={params.id} initialTab={searchParams?.tab} />;
}

