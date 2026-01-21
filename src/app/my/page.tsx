import type { Metadata } from "next";
import { MyPageClient } from "./ui";

export const metadata: Metadata = {
  title: "마이 페이지",
  description: "Panana 마이 페이지",
  alternates: { canonical: "/my" },
};

export default function MyPage() {
  return <MyPageClient />;
}

