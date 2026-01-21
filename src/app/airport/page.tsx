import type { Metadata } from "next";
import AirportStartClient from "./ui";

export const metadata: Metadata = {
  title: "웰컴 투 파나나 공항",
  description: "간단한 입국 심사를 통해 나에게 맞는 캐릭터를 만나보세요.",
  alternates: { canonical: "/airport" },
};

export default function AirportPage() {
  return <AirportStartClient />;
}

