import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";

const DEV_MOCK_PANANA_ID = process.env.DEV_MOCK_PANANA_ID || "aaaaaaaa-bbbb-4ccc-8000-000000000001";

const DEV_MOCK_EMAIL = "goriccc@gmail.com";
const DEV_MOCK_PHONE = "01032067406";
const DEV_MOCK_NAME = "송준호";

/** OAuth 프로필에서 결제용 구매자 이름 추출 (필수 값 보장) */
function resolveOAuthName(user: { name?: string | null; email?: string | null; nickname?: string } | null): string {
  if (!user) return "회원";
  const name = (user as any).name ? String((user as any).name).trim() : "";
  if (name) return name;
  const nickname = (user as any).nickname ? String((user as any).nickname).trim() : "";
  if (nickname) return nickname;
  const email = (user as any).email ? String((user as any).email).trim() : "";
  if (email) return email.split("@")[0] || "회원";
  return "회원";
}

async function ensureDevUser(): Promise<{ id: string; handle: string; nickname: string; email: string; phoneNumber: string; name: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase env missing");
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const handle = "@dev0000";
  const nickname = "개발유저";

  const { data: existing } = await sb
    .from("panana_users")
    .select("id, handle, nickname")
    .eq("id", DEV_MOCK_PANANA_ID)
    .maybeSingle();

  if (existing?.id) {
    return {
      id: String(existing.id),
      handle: String((existing as any).handle || handle),
      nickname: String((existing as any).nickname || nickname),
      email: DEV_MOCK_EMAIL,
      phoneNumber: DEV_MOCK_PHONE,
      name: DEV_MOCK_NAME,
    };
  }

  const { data: inserted, error } = await sb
    .from("panana_users")
    .insert({ id: DEV_MOCK_PANANA_ID, handle, nickname })
    .select("id, handle, nickname")
    .single();

  if (error || !inserted?.id) throw new Error("Dev user create failed");
  const { data: _ } = await sb.from("panana_user_identities").upsert(
    { user_id: inserted.id, provider: "credentials", provider_account_id: "dev" },
    { onConflict: "provider,provider_account_id" }
  );
  return {
    id: String((inserted as any).id),
    handle: String((inserted as any).handle),
    nickname: String((inserted as any).nickname),
    email: DEV_MOCK_EMAIL,
    phoneNumber: DEV_MOCK_PHONE,
    name: DEV_MOCK_NAME,
  };
}

const providers: NextAuthOptions["providers"] = [
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
];

if (process.env.NODE_ENV === "development" || process.env.DEV_MOCK_AUTH === "1") {
  providers.push(
    CredentialsProvider({
      id: "credentials",
      name: "개발 로그인",
      credentials: {},
      async authorize() {
        return ensureDevUser();
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  // DB adapter 없이도 동작(JWT 기반 세션)
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, trigger, session, user }) {
      // 개발 로그인(Credentials): 최초 로그인 시 pananaId 등 저장
      if (account?.provider === "credentials" && user) {
        (token as any).provider = "credentials";
        (token as any).providerAccountId = "dev";
        (token as any).pananaId = (user as any).id;
        (token as any).pananaHandle = (user as any).handle;
        (token as any).pananaNickname = (user as any).nickname;
        (token as any).email = (user as any).email ?? DEV_MOCK_EMAIL;
        (token as any).phoneNumber = (user as any).phoneNumber ?? DEV_MOCK_PHONE;
        (token as any).name = (user as any).name ?? DEV_MOCK_NAME;
      }
      // 구글/카카오/네이버 로그인 시 이름 필수 보장(결제용) — name → nickname → 이메일 앞부분 → "회원"
      if (account?.provider && account.provider !== "credentials" && user) {
        (token as any).name = resolveOAuthName(user as any);
      }
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
      if (session?.user && (token as any)?.phoneNumber) {
        (session.user as any).phoneNumber = String((token as any).phoneNumber);
      }
      // 결제용 구매자 이름: OAuth/개발로그인에서 채운 token.name 세션에 반영
      if (session?.user && (token as any)?.name) {
        session.user.name = String((token as any).name);
      }
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

