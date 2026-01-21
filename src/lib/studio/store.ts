import { create } from "zustand";
import type { StudioLorebookItem, StudioPromptState, TriggerRulesPayload } from "./types";

const seedPrompt: StudioPromptState = {
  system: {
    personalitySummary: "",
    speechGuide: "",
    coreDesire: "",
    fewShotPairs: [
      { id: "fs-1", user: "밥 먹었어?", bot: "(사무를 넘기며) 아직이다. 신경 끄지." },
      { id: "fs-2", user: "밥 먹었어?", bot: "(사무를 넘기며) 아직이다. 신경 끄지." },
    ],
  },
  lorebook: [
    { id: "l-1", key: "방하의 저주", value: "복부 대공 가문의 유전병. 사랑을 하면 심장이 얼어붙는 고통…", unlock: { type: "public" } },
    { id: "l-2", key: "황제, 이복형", value: "현 황제는 카이든을 견제하며 틈만 나면 암살자를 보낸다.", unlock: { type: "affection", min: 30 } },
    { id: "l-3", key: "**어머니의 유품**", value: "(비밀 설정) 카이든이 목숨처럼 아끼는 로켓 목걸이…", unlock: { type: "paid_item", sku: "DIAMOND_01" } },
  ],
  author: {
    forceBracketNarration: true,
    shortLongLimit: false,
    nsfwFilterOff: false,
    authorNote:
      "모든 행동 묘사는 현재형으로 서술하시오.\n유저와의 대화에 몰입하고 AI임을 밝히지 마시오.\n현재 질투 수치가 높으므로 비교는 말투를 유지하시오.",
  },
};

const seedTriggers: TriggerRulesPayload = {
  rules: [
    {
      id: "rule_1",
      name: "호감도 및 친밀도 상승 (긍정적 반응)",
      enabled: true,
      if: {
        type: "AND",
        conditions: [
          { type: "text_includes", values: ["좋아해", "보고 싶어"] },
          { type: "variable_compare", var: "jealousy", op: "<", value: 50 },
        ],
      },
      then: {
        actions: [
          { type: "variable_mod", var: "affection", op: "+", value: 5 },
          { type: "system_message", text: "[시스템] 카이든의 표정이 밝아졌습니다." },
        ],
      },
    },
    {
      id: "rule_2",
      name: "질투 및 집착 발동 (부정적 반응)",
      enabled: true,
      if: {
        type: "OR",
        conditions: [
          { type: "text_includes", values: ["다른 남자", "황제", "기사단장"] },
          { type: "inactive_time", hours: 24 },
        ],
      },
      then: {
        actions: [
          { type: "variable_mod", var: "jealousy", op: "+", value: 15 },
          { type: "variable_mod", var: "affection", op: "-", value: 5 },
          { type: "status_effect", key: "상태: 집착", turns: 3 },
        ],
      },
    },
  ],
};

const seedProjectLorebook: StudioLorebookItem[] = [
  {
    id: "pl-1",
    key: "제국의 법",
    value: "귀족의 혼인과 후계 문제는 황제의 재가가 필요하다.",
    unlock: { type: "public" },
    mergeMode: "override",
  },
  {
    id: "pl-2",
    key: "마력 결계",
    value: "궁정 내부는 특정 문양이 있어야만 통과 가능하다.",
    unlock: { type: "public" },
    mergeMode: "append",
  },
];

const seedProjectRules: TriggerRulesPayload = {
  rules: [
    {
      id: "p_rule_1",
      name: "프로젝트 공통: 예의/톤 유지",
      enabled: true,
      if: { type: "AND", conditions: [{ type: "text_includes", values: ["욕", "비속어"] }] },
      then: { actions: [{ type: "system_message", text: "[시스템] 표현 수위를 조절합니다." }] },
    },
  ],
};

export type StudioSceneConfig = {
  projectId: string;
  sceneId: string;
  title: string;
  episodeLabel: string;
  groupChatEnabled: boolean;
  participantIds: string[]; // cast ids
  lorebook: StudioLorebookItem[];
  rules: TriggerRulesPayload;
};

function seedSceneConfig(projectId: string, sceneId: string): StudioSceneConfig {
  return {
    projectId,
    sceneId,
    title: "씬",
    episodeLabel: "EP",
    groupChatEnabled: true,
    participantIds: ["guide", "emperor", "knight"],
    lorebook: [
      {
        id: "sl-1",
        key: "이번 회차의 사건",
        value: "가면무도회에서 정체가 들킬 위기. 대화는 은유적으로 진행된다.",
        unlock: { type: "public" },
        mergeMode: "override",
      },
    ],
    rules: {
      rules: [
        {
          id: "s_rule_1",
          name: "씬 전용: 긴장 고조",
          enabled: true,
          if: { type: "AND", conditions: [{ type: "text_includes", values: ["정체", "가면"] }] },
          then: { actions: [{ type: "variable_mod", var: "affection", op: "+", value: 1 }] },
        },
      ],
    },
  };
}

type StudioState = {
  promptByCharacter: Record<string, StudioPromptState>;
  triggerByCharacter: Record<string, TriggerRulesPayload>;
  projectLorebookByProjectId: Record<string, StudioLorebookItem[]>;
  projectRulesByProjectId: Record<string, TriggerRulesPayload>;
  sceneConfigByKey: Record<string, StudioSceneConfig>;
  selectedCharacterId: string | null;
  setSelectedCharacterId: (id: string | null) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedSceneId: string | null;
  setSelectedSceneId: (id: string | null) => void;
  getPrompt: (characterId: string) => StudioPromptState;
  setPrompt: (characterId: string, next: StudioPromptState) => void;
  getTriggers: (characterId: string) => TriggerRulesPayload;
  setTriggers: (characterId: string, next: TriggerRulesPayload) => void;
  getProjectLorebook: (projectId: string) => StudioLorebookItem[];
  setProjectLorebook: (projectId: string, next: StudioLorebookItem[]) => void;
  getProjectRules: (projectId: string) => TriggerRulesPayload;
  setProjectRules: (projectId: string, next: TriggerRulesPayload) => void;
  getSceneConfig: (projectId: string, sceneId: string) => StudioSceneConfig;
  setSceneConfig: (projectId: string, sceneId: string, next: StudioSceneConfig) => void;
};

export const useStudioStore = create<StudioState>((set, get) => ({
  promptByCharacter: {},
  triggerByCharacter: {},
  projectLorebookByProjectId: {},
  projectRulesByProjectId: {},
  sceneConfigByKey: {},
  selectedCharacterId: null,
  setSelectedCharacterId: (id) => {
    try {
      if (typeof window !== "undefined") {
        if (id) window.localStorage.setItem("studio_selected_character_id", id);
        else window.localStorage.removeItem("studio_selected_character_id");
      }
    } catch {}
    set({ selectedCharacterId: id });
  },
  selectedProjectId: null,
  setSelectedProjectId: (id) => {
    try {
      if (typeof window !== "undefined") {
        if (id) window.localStorage.setItem("studio_selected_project_id", id);
        else window.localStorage.removeItem("studio_selected_project_id");
      }
    } catch {}
    set({ selectedProjectId: id });
  },
  selectedSceneId: null,
  setSelectedSceneId: (id) => {
    try {
      if (typeof window !== "undefined") {
        if (id) window.localStorage.setItem("studio_selected_scene_id", id);
        else window.localStorage.removeItem("studio_selected_scene_id");
      }
    } catch {}
    set({ selectedSceneId: id });
  },
  getPrompt: (characterId) => get().promptByCharacter[characterId] ?? seedPrompt,
  setPrompt: (characterId, next) =>
    set((s) => ({
      promptByCharacter: { ...s.promptByCharacter, [characterId]: next },
    })),
  getTriggers: (characterId) => get().triggerByCharacter[characterId] ?? seedTriggers,
  setTriggers: (characterId, next) =>
    set((s) => ({
      triggerByCharacter: { ...s.triggerByCharacter, [characterId]: next },
    })),
  getProjectLorebook: (projectId) => get().projectLorebookByProjectId[projectId] ?? seedProjectLorebook,
  setProjectLorebook: (projectId, next) =>
    set((s) => ({ projectLorebookByProjectId: { ...s.projectLorebookByProjectId, [projectId]: next } })),
  getProjectRules: (projectId) => get().projectRulesByProjectId[projectId] ?? seedProjectRules,
  setProjectRules: (projectId, next) =>
    set((s) => ({ projectRulesByProjectId: { ...s.projectRulesByProjectId, [projectId]: next } })),
  getSceneConfig: (projectId, sceneId) => {
    const key = `${projectId}:${sceneId}`;
    return get().sceneConfigByKey[key] ?? seedSceneConfig(projectId, sceneId);
  },
  setSceneConfig: (projectId, sceneId, next) => {
    const key = `${projectId}:${sceneId}`;
    set((s) => ({ sceneConfigByKey: { ...s.sceneConfigByKey, [key]: next } }));
  },
}));

