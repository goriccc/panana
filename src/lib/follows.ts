export type FollowPerson = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  avatarType?: "photo" | "gradient";
  isFollowing: boolean;
};

// NOTE: 어드민/DB 연동 시 "내 팔로워/팔로잉"만 내려오도록 대체 예정
export const dummyFollowers: FollowPerson[] = [
  { id: "f1", name: "여사친 김설아", isFollowing: true },
  { id: "f2", name: "현실에 나타난 요괴는 머리가 3개인데 그...", isFollowing: true },
  { id: "f3", name: "은색머리 마법사", isFollowing: false },
  { id: "f4", name: "외국인 안내미션", isFollowing: false },
  { id: "f5", name: "의류판매원인가요", isFollowing: false },
  { id: "f6", name: "폭탄머리와 정면승부", isFollowing: false },
  { id: "f7", name: "갑자기 미래로 갔다", isFollowing: false },
  { id: "f8", name: "눈을 떠보니 추락중", isFollowing: false },
  { id: "f9", name: "마왕과의 대결중 각성", isFollowing: false },
  { id: "f10", name: "내가 바로 댄스 머신", isFollowing: false },
  { id: "f11", name: "악마는 프라답을 먹는다", isFollowing: false },
  { id: "f12", name: "으쓱으쓱 자란다", isFollowing: false },
  { id: "f13", name: "정통 힙합 싸이퍼", isFollowing: false },
  { id: "f14", name: "하늘에서 유성이 떨어지고 있는데", isFollowing: false },
];

export const dummyFollowing: FollowPerson[] = [
  { id: "g1", name: "으쓱으쓱 자란다", isFollowing: false },
  { id: "g2", name: "내가 바로 댄스 머신", isFollowing: false },
  { id: "g3", name: "눈을 떠보니 추락중", isFollowing: false },
  { id: "g4", name: "여사친 김설아", isFollowing: true },
  { id: "g5", name: "마왕과의 대결중 각성", isFollowing: false },
  { id: "g6", name: "정통 힙합 싸이퍼", isFollowing: false },
  { id: "g7", name: "은색머리 마법사", isFollowing: false },
  { id: "g8", name: "하늘에서 유성이 떨어지고 있는데", isFollowing: false },
  { id: "g9", name: "외국인 안내미션", isFollowing: false },
  { id: "g10", name: "의류판매원인가요", isFollowing: false },
  { id: "g11", name: "폭탄머리와 정면승부", isFollowing: false },
  { id: "g12", name: "현실에 나타난 요괴는 머리가 3개인데 그...", isFollowing: true },
  { id: "g13", name: "갑자기 미래로 갔다", isFollowing: false },
  { id: "g14", name: "악마는 프라답을 먹는다", isFollowing: false },
];

