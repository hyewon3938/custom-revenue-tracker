import { MonthlyReport, MonthlyOverview, OverviewResponse } from "@/lib/types";
import { pad } from "@/lib/utils/format";

/**
 * 순이익 ÷ 매출 마진율 (%, 소수점 1자리 반올림).
 * 매출이 0 이하면 0.
 */
export function calcMarginRate(netProfit: number, revenue: number): number {
  return revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0;
}

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
      label: `${r.period.year}.${pad(r.period.month)}`,
      totalRevenue: r.summary.totalRevenue,
      totalNetProfit: r.summary.totalNetProfit,
      totalQuantity: r.summary.totalQuantity,
      handmadeQuantity: r.summary.handmadeQuantity,
      otherQuantity: r.summary.otherQuantity,
      marginRate: calcMarginRate(
        r.summary.totalNetProfit,
        r.summary.totalRevenue
      ),
      naverRevenue: r.naver.revenue,
      coupangRevenue: r.coupang.revenue,
      offlineRevenue: r.offline.reduce(
        (s: number, v: { revenue: number }) => s + v.revenue,
        0
      ),
      // 마케팅 비용
      naverAdFee: r.naver.fees.adFee,
      coupangAdFee: r.coupang.fees.adFee,
      sponsorshipCost: r.sponsorship?.marketingCost ?? 0,
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
