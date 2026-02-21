"use client";

import { useEffect } from "react";

const PINK_DARK_OFF = "#FF4F9A";
const PINK_DARK_ON = "#C8326F";
const PINK_LIGHT_OFF = "#FFA1CC";
const PINK_LIGHT_ON = "#FF4F9A";

function getSafetyOn(): boolean {
  if (typeof document === "undefined") return false;
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("panana_safety_on="));
  if (cookie) return cookie.split("=")[1] === "1";
  return localStorage.getItem("panana_safety_on") === "1";
}

function applyThemePink(on: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    "--panana-pink",
    on ? PINK_DARK_ON : PINK_DARK_OFF
  );
  document.documentElement.style.setProperty(
    "--panana-pink2",
    on ? PINK_LIGHT_ON : PINK_LIGHT_OFF
  );
}

export function ThemePinkSync() {
  useEffect(() => {
    applyThemePink(getSafetyOn());

    const handler = (e: CustomEvent<{ on: boolean }>) => {
      applyThemePink(e.detail?.on ?? false);
    };
    window.addEventListener(
      "panana-safety-change" as keyof WindowEventMap,
      handler as EventListener
    );
    return () => {
      window.removeEventListener(
        "panana-safety-change" as keyof WindowEventMap,
        handler as EventListener
      );
    };
  }, []);

  return null;
}
