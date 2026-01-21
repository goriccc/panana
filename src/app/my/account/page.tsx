import type { Metadata } from "next";
import { AccountClient } from "./ui";

export const metadata: Metadata = {
  title: "계정설정",
  description: "계정 정보 설정",
  alternates: { canonical: "/my/account" },
};

export default function AccountPage() {
  return <AccountClient />;
}

