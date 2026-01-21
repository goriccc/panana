export type AdminLocale = "ko" | "en" | "ja" | "zh" | "es" | "fr" | "de";

export type I18nText = Partial<Record<AdminLocale, string>> & { ko: string };

export type AdminCategory = {
  id: string;
  slug: string;
  title: I18nText; // #나에게 맞는 같은 카테고리명
  order: number;
  active: boolean;
};

export type AdminCharacter = {
  id: string;
  slug: string;
  name: I18nText;
  tagline: I18nText;
  profileImageUrl: string;
  messageCtaText: I18nText; // "메시지"
  active: boolean;
};

export type AdminCharacterPost = {
  id: string;
  characterId: string;
  imageUrl: string;
  order: number;
  active: boolean;
};

export type AdminHomeHeroCard = {
  id: string;
  title: I18nText;
  subtitle: I18nText;
  imageUrl: string;
  href: string; // 공지/추천/채팅바로가기 등
  active: boolean;
};

export type AdminHomeSection = {
  id: string;
  categoryId: string;
  tagText: I18nText; // "# 나에게 맞는" 같은 섹션 태그
  active: boolean;
};

export type AdminHomeCard = {
  id: string;
  categoryId: string;
  characterSlug: string;
  title: I18nText;
  thumbnailUrl: string;
  tags: I18nText[]; // 카드 내부 태그
  order: number;
  active: boolean;
};

export type AdminNotice = {
  id: string;
  title: I18nText;
  summary: I18nText;
  body: I18nText;
  publishedAt: string | null;
  createdAt: string;
};

export type AdminBillingProduct = {
  id: string;
  sku: string;
  title: I18nText;
  panaAmount: number;
  bonusAmount: number;
  priceKrw: number;
  recommended: boolean;
  active: boolean;
};

export type AdminMembershipPlan = {
  id: string;
  title: I18nText;
  priceLabel: I18nText;
  ctaText: I18nText;
  benefits: I18nText[];
  termsUrl: string;
  active: boolean;
};

export type AdminAirportCopy = {
  id: string;
  startTitle: I18nText;
  startDescription: I18nText;
  skipModalTitle: I18nText;
  skipModalBody: I18nText; // 줄바꿈 포함 가능
  skipLeftText: I18nText;
  skipRightText: I18nText;
  completeCtaText: I18nText;
};

export type AdminSiteSettings = {
  id: string;
  siteName: I18nText;
  siteDescription: I18nText;
  metadataBase: string;
  socialImageUrl: string;
  robotsIndex: boolean;
  footerLine1: I18nText;
  footerLine2: I18nText;
};

