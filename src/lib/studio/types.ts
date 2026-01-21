export type FewShotTurn = {
  id: string;
  role: "user" | "bot";
  text: string;
};

export type FewShotPair = {
  id: string;
  user: string;
  bot: string;
};

export type PromptSystemLayer = {
  personalitySummary: string;
  speechGuide: string;
  coreDesire: string;
  fewShotPairs: FewShotPair[];
};

export type PromptLorebookItem = {
  id: string;
  key: string;
  value: string;
  unlock:
    | { type: "public" }
    | { type: "affection"; min: number }
    | { type: "paid_item"; sku: string };
};

// 프로젝트/씬 로어북은 합성 정책(override/append)을 함께 가질 수 있음
export type StudioMergeMode = "override" | "append";

export type StudioLorebookItem = PromptLorebookItem & {
  mergeMode: StudioMergeMode;
};

export type PromptAuthorNote = {
  forceBracketNarration: boolean;
  shortLongLimit: boolean;
  nsfwFilterOff: boolean;
  authorNote: string;
};

export type StudioPromptState = {
  system: PromptSystemLayer;
  lorebook: PromptLorebookItem[];
  author: PromptAuthorNote;
};

export type TriggerCondition =
  | { type: "text_includes"; values: string[] }
  | { type: "variable_compare"; var: string; op: "<" | ">" | "="; value: number }
  | { type: "inactive_time"; hours: number };

export type TriggerIf = {
  type: "AND" | "OR";
  conditions: TriggerCondition[];
};

export type TriggerAction =
  | { type: "variable_mod"; var: string; op: "+" | "-"; value: number }
  | { type: "system_message"; text: string }
  | { type: "status_effect"; key: string; turns: number };

export type TriggerThen = {
  actions: TriggerAction[];
};

export type TriggerRule = {
  id: string;
  name: string;
  enabled: boolean;
  if: TriggerIf;
  then: TriggerThen;
};

export type TriggerRulesPayload = {
  rules: TriggerRule[];
};

