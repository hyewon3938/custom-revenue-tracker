"use client";

import { useState } from "react";
import { MonthlyReport } from "@/lib/types";

export default function DashboardPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCollect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "데이터 수집 중 오류가 발생했습니다.");
      }
      const data: MonthlyReport = await res.json();
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">월별 매출 분석</h2>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
            })}{" "}
            기준
          </p>
        </div>
        <button
          onClick={handleCollect}
          disabled={isLoading}
          className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "수집 중..." : "데이터 수집 및 분석"}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {!report && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <p className="text-lg">데이터가 없습니다.</p>
          <p className="text-sm mt-1">상단 버튼을 눌러 데이터를 수집하세요.</p>
        </div>
      )}

      {/* TODO: UI 컴포넌트는 추후 구현 */}
      {report && (
        <pre className="text-xs text-gray-500 overflow-auto">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </div>
  );
}
