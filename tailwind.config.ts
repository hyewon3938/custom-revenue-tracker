import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Next.js 기본 전역 변수
        background: "var(--background)",
        foreground: "var(--foreground)",

        // ── 브랜드 블루 ────────────────────────────────
        // 실제 색상값은 globals.css의 CSS 변수에서 관리됩니다.
        brand: {
          50:  "var(--brand-50)",
          100: "var(--brand-100)",
          200: "var(--brand-200)",
          300: "var(--brand-300)",
          400: "var(--brand-400)",
          500: "var(--brand-500)",
          600: "var(--brand-600)",
          700: "var(--brand-700)",
          800: "var(--brand-800)",
          900: "var(--brand-900)",
        },

        // ── 웜 팔레트 ──────────────────────────────────
        warm: {
          50:  "var(--warm-50)",
          100: "var(--warm-100)",
          200: "var(--warm-200)",
          300: "var(--warm-300)",
          400: "var(--warm-400)",
          500: "var(--warm-500)",
          600: "var(--warm-600)",
          700: "var(--warm-700)",
          800: "var(--warm-800)",
          900: "var(--warm-900)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
