import type { Metadata } from "next";
import { LoginClient } from "./ui";

export const metadata: Metadata = {
  title: "로그인",
  description: "Panana 로그인",
  alternates: { canonical: "/login" },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { return?: string };
}) {
  return <LoginClient returnTo={searchParams?.return || "/my"} />;
}

