"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IllustrationPlaceholder } from "@/components/IllustrationPlaceholder";
import { PananaLogo } from "@/components/PananaLogo";
import { ScreenShell } from "@/components/ScreenShell";
import { SurfaceCard } from "@/components/SurfaceCard";
import { fetchAirportCopy, fetchAirportThumbnailSets, publicUrlFromStoragePath } from "@/lib/pananaApp/airportPublic";

function resolveUrl(maybePathOrUrl: string) {
  if (!maybePathOrUrl) return "";
  if (maybePathOrUrl.startsWith("http://") || maybePathOrUrl.startsWith("https://")) return maybePathOrUrl;
  return publicUrlFromStoragePath(maybePathOrUrl);
}

function AirportMediaBlock({
  image,
  video,
  showNext,
  onNext,
}: {
  image: string;
  video: string;
  showNext: boolean;
  onNext: () => void;
}) {
  if (!image && !video) {
    return <IllustrationPlaceholder label="panana AIRPORT" className="mt-5 h-[240px] w-full" />;
  }

  const imageUrl = resolveUrl(image);
  const videoUrl = resolveUrl(video);

  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 이미지 먼저 렌더 + 동영상은 병렬 로딩 후 준비되면 전환
  useEffect(() => {
    setVideoReady(false);
  }, [imageUrl, videoUrl]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!videoUrl) return;

    const onReady = () => setVideoReady(true);
    el.addEventListener("loadeddata", onReady);
    el.addEventListener("canplay", onReady);

    // 병렬 로딩 시작
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    el.play().catch(() => {});

    return () => {
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("canplay", onReady);
    };
  }, [videoUrl]);

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <div className="relative h-[240px] w-full">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              videoUrl && videoReady ? "opacity-0" : "opacity-100"
            }`}
          />
        ) : (
          <div className="absolute inset-0">
            <IllustrationPlaceholder label="panana AIRPORT" className="h-full w-full" />
          </div>
        )}

        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={imageUrl || undefined}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              videoReady ? "opacity-100" : "opacity-0"
            }`}
            muted
            playsInline
            autoPlay
            loop
            preload="auto"
          />
        ) : null}

        {showNext ? (
          <button
            type="button"
            aria-label="다음 썸네일"
            onClick={onNext}
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/35 ring-1 ring-white/15 hover:bg-black/45"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M10 6l6 6-6 6" stroke="rgba(255,255,255,0.8)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function AirportStartClient() {
  const [sets, setSets] = useState<Array<{ image: string; video: string }>>([]);
  const [idx, setIdx] = useState(0);
  const [intro, setIntro] = useState<string | null>(null);

  const fallbackIntro = useMemo(
    () => "공항에 도착하니 많은 인파로 붐비고 있다.\n입국심사대에 내 차례가 왔는데...",
    []
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sets, copy] = await Promise.all([
          fetchAirportThumbnailSets("immigration"),
          fetchAirportCopy("immigration_intro"),
        ]);

        if (!alive) return;

        const normalized = (sets || []).map((s) => ({ image: s.image_path || "", video: s.video_path || "" })).filter((s) => s.image || s.video);
        setSets(normalized);
        setIdx(0);
        setIntro(copy.map((c) => c.text).filter(Boolean).join("\n") || null);
      } catch {
        // 네트워크/권한 문제면 더미로 유지
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const current = sets[idx] || { image: "", video: "" };

  return (
    <>
      <ScreenShell title="웰컴 투 파나나 공항" titleClassName="text-[#ffa1cc]">
        <div className="mb-8">
          <PananaLogo />
        </div>

        <SurfaceCard className="px-6 py-6" variant="outglow">
          <div className="text-center text-[18px] font-semibold tracking-[-0.01em] text-white/90">파나나 공항</div>

          <AirportMediaBlock
            image={current.image}
            video={current.video}
            showNext={sets.length > 1}
            onNext={() => setIdx((v) => (sets.length ? (v + 1) % sets.length : 0))}
          />

          <div className="mt-5 whitespace-pre-line text-center text-[13px] leading-[1.45] text-white/60">
            {intro || fallbackIntro}
          </div>

          <Link
            href="/airport/chat"
            className="mt-6 block w-full rounded-xl bg-panana-pink px-5 py-4 text-center text-[15px] font-semibold text-white"
          >
            입국 심사 시작!
          </Link>

          <Link href="/login?return=/home" className="mt-4 block text-center text-[14px] font-semibold text-panana-pink/80">
            바로 로그인 하기
          </Link>
        </SurfaceCard>
      </ScreenShell>
    </>
  );
}

