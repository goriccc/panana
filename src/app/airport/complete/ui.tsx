"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IllustrationPlaceholder } from "@/components/IllustrationPlaceholder";
import { PananaLogo } from "@/components/PananaLogo";
import { ScreenShell } from "@/components/ScreenShell";
import { SurfaceCard } from "@/components/SurfaceCard";
import { fetchAirportThumbnailSets, publicUrlFromStoragePath } from "@/lib/pananaApp/airportPublic";

function resolveUrl(maybePathOrUrl: string) {
  if (!maybePathOrUrl) return "";
  if (maybePathOrUrl.startsWith("http://") || maybePathOrUrl.startsWith("https://")) return maybePathOrUrl;
  return publicUrlFromStoragePath(maybePathOrUrl);
}

function CompleteMediaBlock({ image, video }: { image: string; video: string }) {
  if (!image && !video) {
    return <IllustrationPlaceholder label="PANANA IMMIGRATION" className="mt-5 h-[260px] w-full" />;
  }

  const imageUrl = resolveUrl(image);
  const videoUrl = resolveUrl(video);

  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    el.play().catch(() => {});

    return () => {
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("canplay", onReady);
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
      </div>
    </div>
  );
}

export function AirportCompleteClient() {
  const [left, setLeft] = useState(10);
  const targetHref = useMemo(() => "/home", []);
  const [imagePath, setImagePath] = useState("");
  const [videoPath, setVideoPath] = useState("");

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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sets = await fetchAirportThumbnailSets("complete");
        if (!alive) return;
        const first = sets.find((s) => Boolean(s.image_path || s.video_path)) || sets[0];
        setImagePath(first?.image_path || "");
        setVideoPath(first?.video_path || "");
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ScreenShell title="입국 완료">
      <div className="mb-7">
        <PananaLogo />
      </div>

      <SurfaceCard className="px-6 py-6" variant="outglow">
        <div className="text-center text-[18px] font-semibold tracking-[-0.01em] text-white/90">
          축하해요! 입국 완료!
        </div>

        <CompleteMediaBlock image={imagePath} video={videoPath} />

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