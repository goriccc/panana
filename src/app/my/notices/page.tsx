import type { Metadata } from "next";
import { NoticesClient } from "./ui";

export const metadata: Metadata = {
  title: "공지사항",
  description: "Panana 공지사항",
  alternates: { canonical: "/my/notices" },
};

export default function NoticesPage() {
  return <NoticesClient />;
}

