"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IllustrationPlaceholder } from "@/components/IllustrationPlaceholder";
import { PananaLogo } from "@/components/PananaLogo";
import { ScreenShell } from "@/components/ScreenShell";
import { SurfaceCard } from "@/components/SurfaceCard";

function AirportMediaBlock({
  videoUrl,
  showNext,
  onNext,
}: {
  videoUrl: string;
  showNext: boolean;
  onNext: () => void;
}) {
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setVideoReady(false);
  }, [videoUrl]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onReady = () => {
      setVideoReady(true);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      el.play().catch(() => {});
    };

    el.addEventListener("loadeddata", onReady);
    el.addEventListener("canplay", onReady);
    el.addEventListener("canplaythrough", onReady);
    el.load();

    return () => {
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("canplaythrough", onReady);
    };
  }, [videoUrl]);

  if (!videoUrl) {
    return <IllustrationPlaceholder label="panana AIRPORT" className="mt-5 h-[240px] w-full" />;
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <div className="relative h-[240px] w-full">
        <video
          ref={videoRef}
          src={videoUrl}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            videoReady ? "opacity-100" : "opacity-0"
          }`}
          muted
          playsInline
          autoPlay
          loop
          preload="auto"
        />

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
  // 동영상만 로드: 입국심사 (1_1.mp4)
  const videoUrl = "/airport/1_1.mp4";

  const fallbackIntro = useMemo(
    () => "공항에 도착하니 많은 인파로 붐비고 있다.\n입국심사대에 내 차례가 왔는데...",
    []
  );

  return (
    <>
      <ScreenShell title="웰컴 투 파나나 공항" titleClassName="text-[#ffa1cc]">
        <div className="mb-8">
          <PananaLogo />
        </div>

        <SurfaceCard className="px-6 py-6" variant="outglow">
          <div className="text-center text-[18px] font-semibold tracking-[-0.01em] text-white/90">파나나 공항</div>

          <AirportMediaBlock
            videoUrl={videoUrl}
            showNext={false}
            onNext={() => {}}
          />

          <div className="mt-5 whitespace-pre-line text-center text-[13px] leading-[1.45] text-white/60">
            {fallbackIntro}
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

