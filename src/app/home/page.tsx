import type { Metadata } from "next";
import { HomeClient } from "./ui";

export const metadata: Metadata = {
  title: "홈",
  description: "Panana 캐릭터 채팅 홈",
  alternates: { canonical: "/home" },
};

export default function HomePage() {
  return <HomeClient />;
}