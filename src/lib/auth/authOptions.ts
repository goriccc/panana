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
    async jwt({ token, account, trigger, session }) {
      // 최초 로그인 시 provider를 토큰에 저장(계정설정 화면에서 표시용)
      if (account?.provider) {
        (token as any).provider = String(account.provider);
      }
      // email이 없는 provider(Kakao/Naver 등)에서도 "계정 식별자"를 표시할 수 있도록 저장
      if (account?.providerAccountId) {
        (token as any).providerAccountId = String(account.providerAccountId);
      }
      // 프로필 이미지/닉네임 등 클라이언트에서 세션 업데이트 요청(useSession().update) 시 반영
      if (trigger === "update" && session) {
        if ((session as any).profileImageUrl !== undefined) (token as any).profileImageUrl = (session as any).profileImageUrl;
        if ((session as any).nickname !== undefined) (token as any).nickname = (session as any).nickname;
        if ((session as any).pananaHandle !== undefined) (token as any).pananaHandle = (session as any).pananaHandle;
        if ((session as any).pananaId !== undefined) (token as any).pananaId = (session as any).pananaId;
        if ((session as any).pananaNickname !== undefined) (token as any).pananaNickname = (session as any).pananaNickname;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).provider = (token as any)?.provider ? String((token as any).provider) : undefined;
      (session as any).providerAccountId = (token as any)?.providerAccountId ? String((token as any).providerAccountId) : undefined;
      (session as any).profileImageUrl = (token as any)?.profileImageUrl ? String((token as any).profileImageUrl) : undefined;
      (session as any).nickname = (token as any)?.nickname ? String((token as any).nickname) : undefined;
      (session as any).pananaHandle = (token as any)?.pananaHandle ? String((token as any).pananaHandle) : undefined;
      (session as any).pananaId = (token as any)?.pananaId ? String((token as any).pananaId) : undefined;
      (session as any).pananaNickname = (token as any)?.pananaNickname ? String((token as any).pananaNickname) : undefined;
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

