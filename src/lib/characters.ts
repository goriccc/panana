export type CharacterCard = {
  id: string;
  author: string;
  title: string;
  description: string;
  tags: string[];
};

export type CharacterProfile = {
  slug: string;
  name: string;
  profileImageUrl?: string; // 어드민에서 관리될 프로필 이미지(지금은 더미/옵션)
  mbti: string;
  followers: number;
  following: number;
  hashtags: string[];
  introTitle: string;
  introLines: string[];
  moodTitle: string;
  moodLines: string[];
  photoCount: number; // "10개의" 숫자에 해당
  photos: { id: string }[]; // 실제 이미지는 어드민에서 관리(지금은 더미)
  sections: { title: string; items: CharacterCard[] }[]; // "# 이런 대화는 어때?" 등
};

const sampleCard: CharacterCard = {
  id: "spinner-1",
  author: "@spinner",
  title: "여사친 김설아",
  description: "오랜 소꿉친구에게 갑자기 크리스마스에 고백을 해버렸는데...",
  tags: ["#여사친", "#고백공격"],
};

function makePhotos(n: number) {
  return Array.from({ length: n }).map((_, i) => ({ id: `p-${i + 1}` }));
}

export const characters: CharacterProfile[] = [
  {
    slug: "seola",
    name: "김설아",
    profileImageUrl: undefined,
    mbti: "INFP",
    followers: 1096,
    following: 968,
    hashtags: ["#여사친", "#고백공격"],
    introTitle: "소개합니다!",
    introLines: [
      "김설아  INFP",
      "",
      "안녕하세요, 설아에요.",
      "조용한 순간과 따뜻한 대화를 좋아해요.",
      "감정에 솔직하고, 작은 것에도 쉽게 마음이 움직이는 편이에요.",
      "천천히, 제 속도로 살아가고 있어요.",
    ],
    moodTitle: "요즘 어때?",
    moodLines: ["오랜 소꿉친구가 갑자기 고백을 하는거야.. 좀 당황하긴 했지만 왠지 싫지가 않은 걸..."],
    photoCount: 10,
    photos: makePhotos(10),
    sections: [
      {
        title: "# 이런 대화는 어때?",
        items: [
          { ...sampleCard, id: "chat-1", author: "@미스터리", title: "불면증 여사친", tags: ["#현실세계", "#여사친"] },
          { ...sampleCard, id: "chat-2", author: "@배고픈작가", title: "만취 소개팅", tags: ["#현실세계", "#소개팅"] },
        ],
      },
      {
        title: "# 도전은 어때?",
        items: [
          { ...sampleCard, id: "challenge-1", author: "@도전", title: "여사친고백작전", tags: ["#여사친", "#고백공격"] },
          { ...sampleCard, id: "challenge-2", author: "@도전", title: "방탈출 콜렉션 12", tags: ["#스릴러", "#방탈출"] },
        ],
      },
    ],
  },
];

export function getCharacter(slug: string) {
  return characters.find((c) => c.slug === slug);
}

