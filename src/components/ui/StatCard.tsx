import type { ReactNode } from "react";

/**
 * 공통 지표 카드 컴포넌트.
 * 월별 대시보드(OverallSummarySection)와 인사이트(OverviewStatCards) 공용.
 * value는 ReactNode로 KRWText / QtyText 등 스타일 컴포넌트를 직접 전달 가능.
 */
interface Props {
  label: string;
  value: ReactNode;
  sub?: string;
  highlight?: boolean;
}

export default function StatCard({ label, value, sub, highlight }: Props) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? "bg-brand-500 border-brand-600 text-white"
          : "bg-white border-warm-200"
      }`}
    >
      <p className={`text-sm ${highlight ? "text-brand-100" : "text-gray-500"}`}>
        {label}
      </p>
      <p
        className={`text-2xl font-bold mt-1 ${
          highlight ? "text-white" : "text-gray-900"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p
          className={`text-xs mt-1 ${
            highlight ? "text-brand-200" : "text-gray-400"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
