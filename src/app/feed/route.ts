import { NextResponse } from "next/server";

const BASE = "https://panana.local";
const SITE_TITLE = "Panana | 캐릭터 채팅";
const SITE_DESCRIPTION =
  "지루한 일상을 영화 같은 씬(Scene)으로 바꾸세요. 섬세한 감정선과 극강의 현실감, 파나나에서 당신은 언제나 주인공입니다.";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(d: Date): string {
  return d.toUTCString();
}

export async function GET() {
  const now = new Date();
  const items: { url: string; title: string; description: string }[] = [
    { url: `${BASE}/`, title: "Panana 홈", description: SITE_DESCRIPTION },
    { url: `${BASE}/home`, title: "홈 · 추천", description: "맞춤 추천 캐릭터와 대화해보세요." },
    { url: `${BASE}/airport`, title: "공항 · 시작하기", description: "캐릭터 추천을 위해 나를 소개해주세요." },
    { url: `${BASE}/category/for-you`, title: "나를 위한", description: "나를 위한 캐릭터 카테고리." },
    { url: `${BASE}/category/new`, title: "새로운 캐릭터", description: "새로 등록된 캐릭터를 만나보세요." },
    { url: `${BASE}/category/popular`, title: "인기 캐릭터", description: "인기 캐릭터와 대화해보세요." },
  ];

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(BASE)}/</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <lastBuildDate>${toRfc822(now)}</lastBuildDate>
    <language>ko</language>
    <atom:link href="${escapeXml(BASE)}/feed" rel="self" type="application/rss+xml"/>
    ${items
      .map(
        (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${toRfc822(now)}</pubDate>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
    </item>`
      )
      .join("")}
  </channel>
</rss>`;

  return new NextResponse(rss.trim(), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
