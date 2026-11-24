"use client";

import { MonthlyReport } from "@/lib/types";

/** 연도 선택 목록 */
const YEAR_OPTIONS = [2024, 2025, 2026];

const MONTHS_PER_YEAR = 12;

/** 월 선택 목록 (1~12) */
const MONTH_OPTIONS = Array.from({ length: MONTHS_PER_YEAR }, (_, i) => i + 1);

interface Props {
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  report: MonthlyReport | null;
  isCollecting: boolean;
  hasSaved: boolean;
  onOpenVersionHistory: () => void;
  onCollect: () => void;
}

export default function MonthlyHeader({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  report,
  isCollecting,
  hasSaved,
  onOpenVersionHistory,
  onCollect,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        {/* 연도 선택 */}
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="border border-warm-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}년
            </option>
          ))}
        </select>

        {/* 월 선택 */}
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(Number(e.target.value))}
          className="border border-warm-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          {MONTH_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>

        {/* 수집 시각 */}
        {report && (
          <span className="text-xs text-gray-400 hidden sm:inline">
            수집:{" "}
            {new Date(report.collectedAt).toLocaleString("ko-KR", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {report && (
          <button
            onClick={onOpenVersionHistory}
            className="text-sm text-brand-500 hover:text-brand-700 transition-colors"
          >
            버전 이력
          </button>
        )}
        <button
          onClick={onCollect}
          disabled={isCollecting}
          className="px-5 py-2.5 bg-brand-500 text-white font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCollecting ? "수집 중..." : hasSaved ? "재수집" : "데이터 수집"}
        </button>
      </div>
    </div>
  );
}
