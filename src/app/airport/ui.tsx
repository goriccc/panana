"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IllustrationPlaceholder } from "@/components/IllustrationPlaceholder";
import { PananaLogo } from "@/components/PananaLogo";
import { ScreenShell } from "@/components/ScreenShell";
import { SurfaceCard } from "@/components/SurfaceCard";

function AirportMediaBlock({
  imageUrl,
  videoUrl,
  showNext,
  onNext,
}: {
  imageUrl: string;
  videoUrl: string;
  showNext: boolean;
  onNext: () => void;
}) {
  if (!imageUrl && !videoUrl) {
    return <IllustrationPlaceholder label="panana AIRPORT" className="mt-5 h-[240px] w-full" />;
  }

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

    const onReady = () => {
      setVideoReady(true);
      // 동영상이 준비되면 즉시 재생
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      el.play().catch(() => {});
    };
    
    // 여러 이벤트로 빠른 감지
    el.addEventListener("loadeddata", onReady);
    el.addEventListener("canplay", onReady);
    el.addEventListener("canplaythrough", onReady);
    
    // 동영상 로딩 즉시 시작
    el.load();

    return () => {
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("canplaythrough", onReady);
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
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
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
  // 로컬 파일 직접 사용: 입국심사 (1.png, 1_1.mp4)
  const imageUrl = "/airport/1.png";
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
            imageUrl={imageUrl}
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

