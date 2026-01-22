import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ConditionalFooter } from "@/app/_components/ConditionalFooter";
import { AuthSessionProvider } from "@/app/_components/AuthSessionProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://panana.local"),
  title: {
    default: "Panana | 캐릭터 채팅",
    template: "%s | Panana",
  },
  description: "버블챗/제타 스타일의 캐릭터 채팅 경험을 Panana에서 시작해보세요.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Panana | 캐릭터 채팅",
    description: "버블챗/제타 스타일의 캐릭터 채팅 경험을 Panana에서 시작해보세요.",
    type: "website",
    url: "/",
    siteName: "Panana",
  },
  twitter: {
    card: "summary_large_image",
    title: "Panana | 캐릭터 채팅",
    description: "버블챗/제타 스타일의 캐릭터 채팅 경험을 Panana에서 시작해보세요.",
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
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthSessionProvider>
          {children}
          <ConditionalFooter />
        </AuthSessionProvider>
      </body>
    </html>
  );
}

