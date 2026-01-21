import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getNotice } from "@/lib/notices";
import { NoticeDetailClient } from "./ui";

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const n = getNotice(params.id);
  if (!n) return { title: "공지사항" };
  return {
    title: "공지사항",
    description: n.title,
    alternates: { canonical: `/my/notices/${n.id}` },
  };
}

export default function NoticeDetailPage({ params }: { params: { id: string } }) {
  const n = getNotice(params.id);
  if (!n) notFound();
  return <NoticeDetailClient id={n.id} />;
}

