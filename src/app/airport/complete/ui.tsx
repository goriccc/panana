"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IllustrationPlaceholder } from "@/components/IllustrationPlaceholder";
import { PananaLogo } from "@/components/PananaLogo";
import { ScreenShell } from "@/components/ScreenShell";
import { SurfaceCard } from "@/components/SurfaceCard";

function CompleteMediaBlock({ imageUrl, videoUrl }: { imageUrl: string; videoUrl: string }) {
  if (!imageUrl && !videoUrl) {
    return <IllustrationPlaceholder label="PANANA IMMIGRATION" className="mt-5 h-[260px] w-full" />;
  }

  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
      <div className="relative h-[260px] w-full">
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
            <IllustrationPlaceholder label="PANANA IMMIGRATION" className="h-full w-full" />
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
      </div>
    </div>
  );
}

export function AirportCompleteClient() {
  const [left, setLeft] = useState(10);
  const targetHref = useMemo(() => "/home", []);
  
  // 로컬 파일 직접 사용: 입국통과 (3.png, 3_3.mp4)
  const imageUrl = "/airport/3.png";
  const videoUrl = "/airport/3_3.mp4";

  useEffect(() => {
    const t = window.setInterval(() => {
      setLeft((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (left === 0) {
      window.location.href = targetHref;
    }
  }, [left, targetHref]);

  return (
    <ScreenShell title="입국 완료">
      <div className="mb-7">
        <PananaLogo />
      </div>

      <SurfaceCard className="px-6 py-6" variant="outglow">
        <div className="text-center text-[18px] font-semibold tracking-[-0.01em] text-white/90">
          축하해요! 입국 완료!
        </div>

        <CompleteMediaBlock imageUrl={imageUrl} videoUrl={videoUrl} />

        <div className="mt-5 text-center text-[13px] text-white/55">
          {left}초 후 자동 입장...
        </div>

        <Link
          href={targetHref}
          className="mt-6 block w-full rounded-xl bg-panana-pink px-5 py-4 text-center text-[15px] font-semibold text-white"
        >
          입장하기
        </Link>
      </SurfaceCard>
    </ScreenShell>
  );
}