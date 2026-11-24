"use client";

import { useState } from "react";
import { MonthlyReport } from "@/lib/types";
import OverallSummarySection from "@/components/dashboard/OverallSummarySection";
import PlatformSection from "@/components/dashboard/PlatformSection";
import SponsorshipCard from "@/components/dashboard/SponsorshipCard";
import RankingSection from "@/components/dashboard/RankingSection";
import MatrixSection from "@/components/dashboard/MatrixSection";
import InsightsSection from "@/components/dashboard/InsightsSection";
import ScrapeWarningBanner from "@/components/dashboard/ScrapeWarningBanner";
import VersionHistoryModal from "@/components/dashboard/VersionHistoryModal";
import MonthlyHeader from "@/components/monthly/MonthlyHeader";
import AlertBanner from "@/components/monthly/AlertBanner";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import { useReportActions } from "@/hooks/useReportActions";
import { useRestoreBanner } from "@/hooks/useRestoreBanner";

const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;

export default function MonthlyPage() {
  const {
    report,
    setReport,
    savedList,
    setSavedList,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    isLoading,
    error,
    setError,
  } = useMonthlyReport(THIS_YEAR, THIS_MONTH);

  const { isCollecting, handleCollect, handleUpdate, handleRegenerate } =
    useReportActions({
      selectedYear,
      selectedMonth,
      setReport,
      setSavedList,
      setError,
    });

  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const { restoreBanner, showRestoreBanner, dismissRestoreBanner } =
    useRestoreBanner();

  // 버전 복구
  const handleRestore = (restored: MonthlyReport) => {
    setReport(restored);
    showRestoreBanner(
      `${selectedYear}년 ${selectedMonth}월 이전 버전으로 복구되었습니다. 현재 데이터는 백업되었습니다.`,
    );
  };

  const hasSaved = savedList.some(
    (r) => r.year === selectedYear && r.month === selectedMonth,
  );

  return (
    <div className="space-y-8">
      {/* ─── 헤더 컨트롤 ─────────────────────────────────────────────── */}
      <MonthlyHeader
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onYearChange={setSelectedYear}
        onMonthChange={setSelectedMonth}
        report={report}
        isCollecting={isCollecting}
        hasSaved={hasSaved}
        onOpenVersionHistory={() => setIsVersionModalOpen(true)}
        onCollect={handleCollect}
      />

      {/* ─── 오류 ────────────────────────────────────────────────────── */}
      {error && <AlertBanner variant="error" message={error} />}

      {/* ─── 복구 안내 ─────────────────────────────────────────────── */}
      {restoreBanner && (
        <AlertBanner
          variant="restore"
          message={restoreBanner}
          onDismiss={dismissRestoreBanner}
        />
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
            sponsorship={
              report.sponsorship ?? {
                items: [],
                marketingCost: 0,
                totalQuantity: 0,
                handmadeQuantity: 0,
              }
            }
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
