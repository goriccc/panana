import type { Metadata } from "next";
import { NotificationsClient } from "./ui";

export const metadata: Metadata = {
  title: "알림설정",
  description: "알림 수신 설정",
  alternates: { canonical: "/my/notifications" },
};

export default function NotificationsPage() {
  return <NotificationsClient />;
}

