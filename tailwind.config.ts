import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Noto Sans KR",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        panana: {
          pink: "#FF4DA7",
          pink2: "#FF5BB6",
          bg: "#0B0C10",
          card: "#101117",
          card2: "#141624",
          border: "rgba(255,255,255,0.10)",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 14px 40px rgba(0,0,0,0.55)",
      },
      keyframes: {
        "scene-loading": {
          "0%, 100%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(300%)" },
        },
      },
      animation: {
        "scene-loading": "scene-loading 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

