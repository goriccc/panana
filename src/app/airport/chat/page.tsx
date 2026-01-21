import type { Metadata } from "next";
import { AirportChatClient } from "./ui";

export const metadata: Metadata = {
  title: "웰컴 투 파나나 공항 - 입국 심사",
  description: "간단한 질문에 답하고 나에게 맞는 캐릭터를 만나보세요.",
  alternates: { canonical: "/airport/chat" },
};

export default function AirportChatPage() {
  return <AirportChatClient />;
}

