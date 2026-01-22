"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import type { CharacterProfile } from "@/lib/characters";
import { ContentCard } from "@/components/ContentCard";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-[18px] font-bold text-white/90">{value.toLocaleString("ko-KR")}</div>
      <div className="mt-1 text-[11px] font-semibold text-white/40">{label}</div>
    </div>
  );
}

function PhotoTile({ seed }: { seed: string }) {
  return (
    <div
      className="aspect-square w-full rounded-none bg-[radial-gradient(900px_300px_at_30%_20%,rgba(255,77,167,0.18),transparent_55%),radial-gradient(700px_260px_at_70%_70%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02))]"
      data-seed={seed}
      aria-hidden="true"
    />
  );
}

export function CharacterClient({ character }: { character: CharacterProfile }) {
  const photos = useMemo(() => character.photos, [character.photos]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_650px_at_50%_-10%,rgba(255,77,167,0.12),transparent_60%),linear-gradient(#07070B,#0B0C10)] text-white">
      <style>{`
        @keyframes pananaPulse {
          0%, 100% { transform: scale(1); opacity: .55; }
          50% { transform: scale(1.035); opacity: 1; }
        }
        @keyframes pananaCtaFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.5px); }
        }
        @keyframes pananaCtaGlow {
          0%, 100% { opacity: .22; transform: scale(0.98); }
          50% { opacity: .45; transform: scale(1.06); }
        }
        @keyframes pananaCtaGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      {/* top bar */}
      <header className="mx-auto w-full max-w-[420px] px-5 pt-3">
        <div className="relative flex h-11 items-center">
          <Link href="/home" aria-label="뒤로가기" className="absolute left-0 p-2">
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

          <div className="mx-auto text-[18px] font-semibold tracking-[-0.01em] text-[#ffa9d6]">
            {character.name}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[420px] px-5 pb-16 pt-2">
        {/* profile row */}
        <div className="mt-2">
          <div className="flex items-center gap-4">
            <Link
              href={`/c/${character.slug}/profile-image`}
              aria-label="프로필 이미지 보기"
              className="relative block h-[56px] w-[56px] overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
            >
              {character.profileImageUrl ? (
                <Image
                  src={character.profileImageUrl}
                  alt={`${character.name} 프로필`}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : null}
            </Link>

            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold text-white/85">{character.name}</div>
              <div className="mt-1 flex items-center gap-5">
                <Link href={`/c/${character.slug}/follows?tab=followers`} aria-label="팔로워 목록">
                  <Stat value={character.followers} label="팔로워" />
                </Link>
                <Link href={`/c/${character.slug}/follows?tab=following`} aria-label="팔로잉 목록">
                  <Stat value={character.following} label="팔로잉" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-semibold text-[#ffa9d6]">
            {character.hashtags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="rounded-xl bg-[#e5e5eb] px-4 py-3 text-center text-[14px] font-semibold text-[#0B0C10]"
            >
              팔로우
            </button>
            <Link
              href={`/c/${character.slug}/chat`}
              className="group relative overflow-hidden rounded-xl px-4 py-3 text-center text-[14px] font-extrabold text-white ring-1 ring-white/10 transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#ff4da7]/40"
              style={{
                backgroundImage:
                  "linear-gradient(110deg, rgba(255,77,167,1) 0%, rgba(255,126,201,1) 40%, rgba(255,77,167,1) 100%)",
                backgroundSize: "200% 200%",
                animation: "pananaCtaFloat 2.8s ease-in-out infinite, pananaCtaGradient 4.6s ease-in-out infinite",
                boxShadow: "0 18px 46px rgba(255,77,167,0.26)",
              }}
            >
              {/* glow blob */}
              <span
                className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 blur-2xl"
                style={{ animation: "pananaCtaGlow 2.6s ease-in-out infinite" }}
              />
              {/* subtle ring */}
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-[#ff4da7]/25" />

              <span className="relative z-10 inline-flex items-center justify-center gap-2">
                메시지
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/15 ring-1 ring-white/20 transition-transform group-hover:translate-x-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M13 5l7 7-7 7"
                      stroke="rgba(255,255,255,0.92)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 12h14"
                      stroke="rgba(255,255,255,0.92)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </span>
            </Link>
          </div>
        </div>

        {/* intro */}
        <div className="mt-5">
          <div className="text-[13px] font-extrabold tracking-[-0.01em] text-white/85">{character.introTitle}</div>
          <div className="mt-2 whitespace-pre-line text-[12px] leading-[1.65] text-white/60">
            {character.introLines.join("\n")}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[13px] font-extrabold tracking-[-0.01em] text-white/85">{character.moodTitle}</div>
          <div className="mt-2 whitespace-pre-line text-[12px] leading-[1.65] text-white/60">
            {character.moodLines.join("\n")}
          </div>
        </div>

        {/* photos */}
        <div className="mt-8">
          <div className="text-[13px] font-extrabold tracking-[-0.01em] text-white/85">
            {character.photoCount}개의 게시물이 있어요.
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <PhotoTile key={p.id} seed={p.id} />
            ))}
          </div>
        </div>

        {/* sections */}
        <div className="mt-10 space-y-10">
          {character.sections.map((s) => (
            <section key={s.title}>
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-white/75">{s.title}</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {s.items.map((it) => (
                  <ContentCard
                    key={it.id}
                    author={it.author}
                    title={it.title}
                    description={it.description}
                    tags={it.tags}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

