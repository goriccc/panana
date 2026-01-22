import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID || "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
    }),
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID || "",
      clientSecret: process.env.NAVER_CLIENT_SECRET || "",
    }),
  ],
  // DB adapter 없이도 동작(JWT 기반 세션)
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account }) {
      // 최초 로그인 시 provider를 토큰에 저장(계정설정 화면에서 표시용)
      if (account?.provider) {
        (token as any).provider = String(account.provider);
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).provider = (token as any)?.provider ? String((token as any).provider) : undefined;
      return session;
    },
    async redirect({ url, baseUrl }) {
      // callbackUrl로 상대경로(/home 등) 전달된 경우 baseUrl에 붙여서 허용
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // 동일 origin만 허용
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
};

