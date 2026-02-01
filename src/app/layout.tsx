import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConditionalFooter } from "@/app/_components/ConditionalFooter";
import { AuthSessionProvider } from "@/app/_components/AuthSessionProvider";
import { PananaIdentityInit } from "@/app/_components/PananaIdentityInit";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://panana-one.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [
      { url: "/Favicon16.svg", sizes: "16x16", type: "image/svg+xml" },
      { url: "/Favicon32.svg", sizes: "32x32", type: "image/svg+xml" },
      { url: "/Favicon48.svg", sizes: "48x48", type: "image/svg+xml" },
      { url: "/Favicon128.svg", sizes: "128x128", type: "image/svg+xml" },
      { url: "/Favicon192.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
  },
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
    images: [{ url: "/Open_Graph.jpg", width: 1200, height: 630, alt: "Panana" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Panana | 캐릭터 채팅",
    description: "지루한 일상을 영화 같은 씬(Scene)으로 바꾸세요. 섬세한 감정선과 극강의 현실감, 파나나에서 당신은 언제나 주인공입니다.",
    images: ["/Open_Graph.jpg"],
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

