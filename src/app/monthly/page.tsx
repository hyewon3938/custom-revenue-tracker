"use client";

import { useState, useEffect, useCallback } from "react";
import { MonthlyReport } from "@/lib/types";
import OverallSummarySection from "@/components/dashboard/OverallSummarySection";
import PlatformSection from "@/components/dashboard/PlatformSection";
import SponsorshipCard from "@/components/dashboard/SponsorshipCard";
import RankingSection from "@/components/dashboard/RankingSection";
import MatrixSection from "@/components/dashboard/MatrixSection";
import InsightsSection from "@/components/dashboard/InsightsSection";
import ScrapeWarningBanner from "@/components/dashboard/ScrapeWarningBanner";
import VersionHistoryModal from "@/components/dashboard/VersionHistoryModal";

const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;

export default function MonthlyPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [savedList, setSavedList] = useState<{ year: number; month: number }[]>([]);
  const [selectedYear, setSelectedYear] = useState(THIS_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(THIS_MONTH);

  const [isLoading, setIsLoading] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [restoreBanner, setRestoreBanner] = useState<string | null>(null);

  // 저장된 레포트 목록 초기 로드
  useEffect(() => {
    fetch("/api/report")
      .then((r) => r.json())
      .then((list: { year: number; month: number }[]) => {
        setSavedList(list);
        if (list.length > 0) {
          setSelectedYear(list[0].year);
          setSelectedMonth(list[0].month);
        }
      })
      .catch(console.error);
  }, []);

  // 선택 월 변경 시 레포트 로드
  useEffect(() => {
    const exists = savedList.some(
      (r) => r.year === selectedYear && r.month === selectedMonth
    );
    if (!exists) {
      setReport(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    fetch(`/api/report?year=${selectedYear}&month=${selectedMonth}`)
      .then((r) => {
        if (!r.ok) throw new Error("레포트 로드 실패");
        return r.json();
      })
      .then((data: MonthlyReport) => setReport(data))
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [selectedYear, selectedMonth, savedList]);

  // 데이터 수집
  const handleCollect = async () => {
    setIsCollecting(true);
    setError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selectedYear, month: selectedMonth }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "데이터 수집 중 오류가 발생했습니다.");
      }
      const data: MonthlyReport = await res.json();
      setReport(data);
      setSavedList((prev) => {
        const exists = prev.some(
          (r) => r.year === selectedYear && r.month === selectedMonth
        );
        if (exists) return prev;
        return [{ year: selectedYear, month: selectedMonth }, ...prev];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setIsCollecting(false);
    }
  };

  // 수기 편집 (PATCH)
  const handleUpdate = useCallback(
    async (patch: object) => {
      try {
        const res = await fetch("/api/report", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year: selectedYear,
            month: selectedMonth,
            ...patch,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "저장 실패");
        }
        const updated: MonthlyReport = await res.json();
        setReport(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
      }
    },
    [selectedYear, selectedMonth]
  );

  // AI 인사이트 재생성
  const handleRegenerate = async () => {
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selectedYear, month: selectedMonth }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "인사이트 생성 실패");
      }
      const { insights, insightsGeneratedAt, lastModifiedAt } = await res.json();
      setReport((prev) =>
        prev ? { ...prev, insights, insightsGeneratedAt, lastModifiedAt } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "인사이트 생성 중 오류가 발생했습니다.");
    }
  };

  // 버전 복구
  const handleRestore = (restored: MonthlyReport) => {
    setReport(restored);
    setRestoreBanner(
      `${selectedYear}년 ${selectedMonth}월 이전 버전으로 복구되었습니다. 현재 데이터는 백업되었습니다.`
    );
    setTimeout(() => setRestoreBanner(null), 8000);
  };

  const hasSaved = savedList.some(
    (r) => r.year === selectedYear && r.month === selectedMonth
  );

  return (
    <div className="space-y-8">
      {/* ─── 헤더 컨트롤 ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* 연도 선택 */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>

          {/* 월 선택 */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="border border-warm-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
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
              onClick={() => setIsVersionModalOpen(true)}
              className="text-sm text-brand-500 hover:text-brand-700 transition-colors"
            >
              버전 이력
            </button>
          )}
          <button
            onClick={handleCollect}
            disabled={isCollecting}
            className="px-5 py-2.5 bg-brand-500 text-white font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCollecting ? "수집 중..." : hasSaved ? "재수집" : "데이터 수집"}
          </button>
        </div>
      </div>

      {/* ─── 오류 ────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ─── 복구 안내 ─────────────────────────────────────────────── */}
      {restoreBanner && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center justify-between">
          <span>{restoreBanner}</span>
          <button
            onClick={() => setRestoreBanner(null)}
            className="text-blue-400 hover:text-blue-600 ml-4 shrink-0"
          >
            &times;
          </button>
        </div>
      )}

      {/* ─── 로딩 ────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <p>불러오는 중...</p>
        </div>
      )}

      {/* ─── 빈 상태 ─────────────────────────────────────────────────── */}
      {!report && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <p className="text-lg">데이터가 없습니다.</p>
          <p className="text-sm mt-1">상단 버튼을 눌러 데이터를 수집하세요.</p>
        </div>
      )}

      {/* ─── 대시보드 섹션 ───────────────────────────────────────────── */}
      {report && !isLoading && (
        <>
          <ScrapeWarningBanner warnings={report.warnings ?? []} />

          <OverallSummarySection summary={report.summary} />

          <PlatformSection
            year={selectedYear}
            month={selectedMonth}
            naver={report.naver}
            coupang={report.coupang}
            offline={report.offline}
            productMatrix={report.productMatrix}
            onUpdate={handleUpdate}
          />

          <SponsorshipCard
            sponsorship={report.sponsorship ?? { items: [], marketingCost: 0, totalQuantity: 0, handmadeQuantity: 0 }}
            productMatrix={report.productMatrix}
            onUpdate={handleUpdate}
          />

          <RankingSection
            overallRanking={report.overallRanking}
            naverRanking={report.naverRanking}
            coupangRanking={report.coupangRanking}
            offlineRanking={report.offlineRanking}
            sponsorExcludedRanking={report.sponsorExcludedRanking}
          />

          <MatrixSection
            matrix={report.productMatrix}
            sponsoredItems={report.sponsorship?.items}
          />

          <InsightsSection
            insights={report.insights}
            insightsGeneratedAt={report.insightsGeneratedAt}
            lastModifiedAt={report.lastModifiedAt}
            onRegenerate={handleRegenerate}
          />
        </>
      )}

      {/* ─── 버전 이력 모달 ────────────────────────────────────────── */}
      <VersionHistoryModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        year={selectedYear}
        month={selectedMonth}
        onRestore={handleRestore}
      />
    </div>
  );
}
