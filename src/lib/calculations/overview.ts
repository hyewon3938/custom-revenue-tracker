import { MonthlyReport, MonthlyOverview, OverviewResponse } from "@/lib/types";

/**
 * MonthlyReport 배열 → 인사이트 차트용 개요 데이터로 집계.
 * 마진율은 미리 계산, 월별 오름차순 정렬 (차트 X축 좌→우).
 *
 * I/O 없는 순수 함수 — 호출자가 레포트를 로드해서 전달.
 */
export function buildOverviewData(reports: MonthlyReport[]): OverviewResponse {
  const months: MonthlyOverview[] = reports
    .map((r) => ({
      period: r.period,
      label: `${r.period.year}.${String(r.period.month).padStart(2, "0")}`,
      totalRevenue: r.summary.totalRevenue,
      totalNetProfit: r.summary.totalNetProfit,
      totalQuantity: r.summary.totalQuantity,
      handmadeQuantity: r.summary.handmadeQuantity,
      otherQuantity: r.summary.otherQuantity,
      marginRate:
        r.summary.totalRevenue > 0
          ? Math.round(
              (r.summary.totalNetProfit / r.summary.totalRevenue) * 1000
            ) / 10
          : 0,
      naverRevenue: r.naver.revenue,
      coupangRevenue: r.coupang.revenue,
      offlineRevenue: r.offline.reduce(
        (s: number, v: { revenue: number }) => s + v.revenue,
        0
      ),
    }))
    .sort((a, b) =>
      a.period.year !== b.period.year
        ? a.period.year - b.period.year
        : a.period.month - b.period.month
    );

  const totals = months.reduce(
    (acc, m) => ({
      totalQuantity: acc.totalQuantity + m.totalQuantity,
      handmadeQuantity: acc.handmadeQuantity + m.handmadeQuantity,
      totalRevenue: acc.totalRevenue + m.totalRevenue,
      totalNetProfit: acc.totalNetProfit + m.totalNetProfit,
    }),
    {
      totalQuantity: 0,
      handmadeQuantity: 0,
      totalRevenue: 0,
      totalNetProfit: 0,
    }
  );

  return { months, totals };
}
