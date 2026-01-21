import type { Metadata } from "next";
import { AirportCompleteClient } from "./ui";

export const metadata: Metadata = {
  title: "입국 완료",
  description: "입국 심사가 완료되었습니다. Panana에 입장해보세요.",
  alternates: { canonical: "/airport/complete" },
};

export default function AirportCompletePage() {
  return <AirportCompleteClient />;
}

