import { SalesInsight } from "@/lib/types";

// 타입 순서: 주의 → 액션 → 관찰 → 긍정
export const TYPE_ORDER: SalesInsight["type"][] = [
  "negative",
  "action",
  "neutral",
  "positive",
];

export interface InsightTypeConfig {
  label: string;
  icon: string;
  accentBg: string;
  accentText: string;
  iconBg: string;
  dotColor: string;
}

// Tailwind 가 클래스를 찾도록 색상 클래스는 완성된 문자열로 둔다
export const TYPE_CONFIG: Record<SalesInsight["type"], InsightTypeConfig> = {
  negative: {
    label: "주의",
    icon: "!",
    accentBg: "bg-[#D94848]",
    accentText: "text-white",
    iconBg: "bg-[#E56060]",
    dotColor: "bg-[#FF5555]",
  },
  action: {
    label: "액션",
    icon: "→",
    accentBg: "bg-[#4A9CE6]",
    accentText: "text-white",
    iconBg: "bg-[#60B5FF]",
    dotColor: "bg-[#60B5FF]",
  },
  neutral: {
    label: "관찰",
    icon: "i",
    accentBg: "bg-[#88A4B8]",
    accentText: "text-white",
    iconBg: "bg-[#9CB8CC]",
    dotColor: "bg-[#AFDDFF]",
  },
  positive: {
    label: "긍정",
    icon: "✓",
    accentBg: "bg-[#6BA55A]",
    accentText: "text-white",
    iconBg: "bg-[#7DB86C]",
    dotColor: "bg-[#A3D78A]",
  },
};

/** ISO 타임스탬프 → "3월 1일 15:30 생성" (실행 환경의 로컬 시간대 기준) */
export function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}월 ${day}일 ${h}:${min} 생성`;
}
