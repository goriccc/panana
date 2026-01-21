import type { Metadata } from "next";
import { MyEditClient } from "./ui";

export const metadata: Metadata = {
  title: "프로필 편집",
  description: "프로필 정보를 편집합니다.",
  alternates: { canonical: "/my/edit" },
};

export default function MyEditPage() {
  return <MyEditClient />;
}

