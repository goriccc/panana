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

// 로어북 합성 정책(override/append)
export type StudioMergeMode = "override" | "append";

export type PromptLorebookItem = {
  id: string;
  key: string;
  value: string;
  // 캐릭터 로어북도 mergeMode를 저장/보존할 수 있게 허용(현재 합성 엔진은 프로젝트/씬 합성에서 주로 사용)
  mergeMode?: StudioMergeMode;
  unlock:
    | { type: "public" }
    | { type: "affection"; min: number }
    | { type: "paid_item"; sku: string }
    | { type: "condition"; expr: string; costPanana?: number }
    | { type: "ending_route"; endingKey?: string; epMin?: number; costPanana?: number };
};

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
  meta?: {
    operatorMemo?: string;
  };
};

export type TriggerCondition =
  | { type: "text_includes"; values: string[] }
  | { type: "variable_compare"; var: string; op: "<" | ">" | "=" | "<=" | ">="; value: number }
  | { type: "string_compare"; var: string; op: "=" | "!="; value: string }
  | { type: "participant_present"; name: string }
  | { type: "inactive_time"; hours: number };

export type TriggerIf = {
  type: "AND" | "OR";
  conditions: TriggerCondition[];
};

export type TriggerAction =
  | { type: "variable_mod"; var: string; op: "+" | "-"; value: number }
  | { type: "variable_set"; var: string; value: string | number | boolean }
  | { type: "system_message"; text: string }
  | { type: "status_effect"; key: string; turns: number }
  | { type: "join"; name: string }
  | { type: "leave"; name: string };

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
  // (선택) 변수 표시 라벨(콘텐츠별 커스텀)
  // 예: { contract: "광고 계약확률", stress: "스트레스" }
  varLabels?: Record<string, string>;
};

