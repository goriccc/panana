import type { Metadata } from "next";
import { ResetClient } from "./ui";

export const metadata: Metadata = {
  title: "초기화",
  description: "서비스 초기화",
  alternates: { canonical: "/my/reset" },
};

export default function ResetPage() {
  return <ResetClient />;
}

