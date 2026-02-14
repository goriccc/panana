import { RootRedirect } from "@/app/_components/RootRedirect";

/**
 * 루트(/)는 200 + OG 메타가 포함된 HTML을 반환하고, 클라이언트에서 /airport로 이동.
 * 서버 리다이렉트(302)를 쓰지 않아 SNS·메신저 크롤러가 https://panana.kr/ 링크 미리보기에 OG를 표시할 수 있음.
 */
export default function RootPage() {
  return <RootRedirect />;
}

