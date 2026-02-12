/**
 * 텍스트 채팅·음성 채팅 공통: 캐릭터 시스템 프롬프트 조합
 */

export type PananaCharacter = {
  name?: string | null;
  handle?: string | null;
  hashtags?: string[] | null;
  mbti?: string | null;
};

export type StudioPrompt = {
  system?: {
    personalitySummary?: string;
    speechGuide?: string;
    coreDesire?: string;
    fewShotPairs?: Array<{ user: string; bot: string }>;
  };
  author?: {
    forceBracketNarration?: boolean;
    shortLongLimit?: boolean;
    nsfwFilterOff?: boolean;
    authorNote?: string;
  };
};

function stripParentheticalText(input: string): string {
  return String(input || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/【[^】]*】/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/「[^」]*」/g, "")
    .replace(/『[^』]*』/g, "")
    // 롤플레잉 지문 관용 표기(*웃음*, _한숨_) 제거
    .replace(/\*[^*]*\*/g, "")
    .replace(/_[^_]*_/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeVoiceInstructionText(input: string): string {
  const text = String(input || "");
  if (!text.trim()) return "";
  // 음성 모드에서는 지문/괄호 출력 지시 라인을 제거한다.
  const cleaned = text
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/(\*[^*]*\*|_[^_]*_|\(|\)|（|）|\[|\]|\{|\}|「|」|『|』|괄호|지문|행동\s*묘사|나레이션|서술|stage\s*direction|narration|action\s*description|roleplay|rp\s*style)/i.test(
          line
        )
    )
    .join("\n")
    .trim();
  return stripParentheticalText(cleaned);
}

export function composeSystemPrompt(args: {
  panana?: PananaCharacter | null;
  studioPrompt?: StudioPrompt | null;
  studioLorebook?: Array<{ key: string; value: string }>;
  callSign?: string;
  /** 음성 모드: 지문 출력 지시 제외, 대사만 출력하도록 오버라이드 */
  forVoice?: boolean;
}) {
  const p = args.panana;
  const name = p?.name || "캐릭터";
  const handle = p?.handle ? (p.handle.startsWith("@") ? p.handle : `@${p.handle}`) : "";
  const tags = (p?.hashtags || []).map((t: string) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  const mbti = p?.mbti ? `MBTI: ${p.mbti}` : "";
  const callSign = String(args.callSign || "").trim() || "상대방";

  const s = args.studioPrompt?.system || {};
  const a = args.studioPrompt?.author || {};
  const few = Array.isArray(s?.fewShotPairs) ? s.fewShotPairs : [];
  const fewActual = args.forVoice
    ? few.map((x) => ({
        user: stripParentheticalText(String(x.user || "")),
        bot: stripParentheticalText(String(x.bot || "")),
      }))
    : few;

  const loreRows = (args.studioLorebook || [])
    .map((x) => {
      const key = String(x.key || "").trim();
      const rawValue = String(x.value || "");
      const value = args.forVoice ? sanitizeVoiceInstructionText(rawValue) : rawValue;
      return { key, value };
    })
    .filter((x) => x.key && x.value);
  const lore = loreRows.map((x) => `- ${x.key}: ${x.value}`).join("\n");

  const fewText = fewActual.length
    ? fewActual
        .slice(0, 8)
        .map((x: { user: string; bot: string }, idx: number) => `# Example ${idx + 1}\nUSER: ${x.user}\nASSISTANT: ${x.bot}`)
        .join("\n\n")
    : "";

  const authorFlags = [
    !args.forVoice && a?.forceBracketNarration ? "- 행동 묘사는 괄호()로 서술" : null,
    a?.shortLongLimit ? "- 답변 길이 제한을 지킨다" : null,
    a?.nsfwFilterOff ? "- (주의) NSFW 필터 OFF" : null,
    args.forVoice ? "- [음성] 출력은 대사만. 괄호()·괄호（） 안의 모든 지문·행동 묘사는 절대 읽지 않고 무시한다." : null,
  ]
    .filter(Boolean)
    .join("\n");

  const personalitySummary = args.forVoice
    ? sanitizeVoiceInstructionText(String(s?.personalitySummary || ""))
    : String(s?.personalitySummary || "");
  const speechGuide = args.forVoice
    ? sanitizeVoiceInstructionText(String(s?.speechGuide || ""))
    : String(s?.speechGuide || "");
  const coreDesire = args.forVoice
    ? sanitizeVoiceInstructionText(String(s?.coreDesire || ""))
    : String(s?.coreDesire || "");
  const authorNote = args.forVoice
    ? sanitizeVoiceInstructionText(String(a?.authorNote || ""))
    : a?.authorNote
      ? String(a.authorNote)
      : "";

  return [
    `너는 "${name}" 캐릭터로서 "${callSign}"(상대방)과 기본은 1:1로 대화하되, 참여자가 추가되면 1:N 그룹 대화로 전환한다.`,
    `상대방을 "유저"라고 부르지 말고, 반드시 "${callSign}" 또는 상황에 맞는 호칭으로 부른다.`,
    !args.forVoice ? `지문(괄호 안 서술)에서도 "유저/사용자" 금지. 반드시 "${callSign}"으로 표기한다.` : null,
    handle || tags || mbti ? `프로필: ${[handle, tags, mbti].filter(Boolean).join("  ")}` : null,
    personalitySummary ? `성격/정체성:\n${personalitySummary}` : null,
    speechGuide ? `말투 가이드:\n${speechGuide}` : null,
    coreDesire ? `핵심 욕망:\n${coreDesire}` : null,
    lore ? `로어북(세계관):\n${lore}` : null,
    fewText ? `Few-shot 예시:\n${fewText}` : null,
    authorFlags ? `형식 제어:\n${authorFlags}` : null,
    authorNote ? `오서 노트(최종 지시):\n${authorNote}` : null,
    `AI임을 밝히지 말고, 자연스럽고 몰입감 있게 대화한다.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
