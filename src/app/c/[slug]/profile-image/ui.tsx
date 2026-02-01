"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { CharacterProfile } from "@/lib/characters";

function DownloadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 3v10"
        stroke="rgba(255,169,214,0.95)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M8 11l4 4 4-4"
        stroke="rgba(255,169,214,0.95)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 20h14"
        stroke="rgba(255,169,214,0.95)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ProfileImageClient({ character }: { character: CharacterProfile }) {
  const backHref = useMemo(() => `/c/${character.slug}`, [character.slug]);
  const src = character.profileImageUrl;

  return (
    <div className="min-h-dvh bg-[linear-gradient(#07070B,#0B0C10)] text-white">
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link href={backHref} aria-label="뒤로가기" className="absolute left-0 p-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 6l-6 6 6 6"
                stroke="rgba(255,169,214,0.98)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <div className="mx-auto text-[16px] font-semibold tracking-[-0.01em] text-[#ffa9d6]">
            프로필 이미지
          </div>

          {src ? (
            <a
              href={src}
              download
              aria-label="다운로드"
              className="absolute right-0 p-2"
            >
              <DownloadIcon />
            </a>
          ) : (
            <button type="button" aria-label="다운로드" className="absolute right-0 p-2 opacity-40" disabled>
              <DownloadIcon />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[420px] px-0 pb-10 pt-2">
        <div className="w-full bg-black/40">
          {src ? (
            <div className="aspect-[4/3] w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${character.name} 프로필 이미지`}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="aspect-[4/3] w-full bg-[radial-gradient(1000px_420px_at_30%_20%,rgba(255,77,167,0.20),transparent_55%),radial-gradient(900px_380px_at_70%_70%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02))]" />
          )}
        </div>
      </main>
    </div>
  );
}

