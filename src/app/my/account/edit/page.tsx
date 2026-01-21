import type { Metadata } from "next";
import { AccountEditClient } from "./ui";

export const metadata: Metadata = {
  title: "내 정보 수정하기",
  description: "내 정보(생년월일/성별)를 수정합니다.",
  alternates: { canonical: "/my/account/edit" },
};

export default function AccountEditPage() {
  return <AccountEditClient />;
}

