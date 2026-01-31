import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConditionalFooter } from "@/app/_components/ConditionalFooter";
import { AuthSessionProvider } from "@/app/_components/AuthSessionProvider";
import { PananaIdentityInit } from "@/app/_components/PananaIdentityInit";

export const metadata: Metadata = {
  metadataBase: new URL("https://panana.local"),
  title: {
    default: "Panana | 캐릭터 채팅",
    template: "%s | Panana",
  },
  description: "지루한 일상을 영화 같은 씬(Scene)으로 바꾸세요. 섬세한 감정선과 극강의 현실감, 파나나에서 당신은 언제나 주인공입니다.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Panana | 캐릭터 채팅",
    description: "지루한 일상을 영화 같은 씬(Scene)으로 바꾸세요. 섬세한 감정선과 극강의 현실감, 파나나에서 당신은 언제나 주인공입니다.",
    type: "website",
    url: "/",
    siteName: "Panana",
  },
  twitter: {
    card: "summary_large_image",
    title: "Panana | 캐릭터 채팅",
    description: "지루한 일상을 영화 같은 씬(Scene)으로 바꾸세요. 섬세한 감정선과 극강의 현실감, 파나나에서 당신은 언제나 주인공입니다.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0C10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Panana"
          href="/feed"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthSessionProvider>
          <PananaIdentityInit />
          {children}
          <ConditionalFooter />
        </AuthSessionProvider>
      </body>
    </html>
  );
}

