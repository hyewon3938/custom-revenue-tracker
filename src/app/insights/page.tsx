import { listReports, loadReport } from "@/lib/storage/report-store";
import { MonthlyOverview, OverviewResponse } from "@/lib/types";
import OverviewStatCards from "@/components/insights/OverviewStatCards";
import ChartsSection from "@/components/insights/ChartsSection";

async function getOverviewData(): Promise<OverviewResponse> {
  const list = await listReports();

  const results = await Promise.all(
    list.map(({ year, month }) => loadReport(year, month))
  );

  const months: MonthlyOverview[] = results
    .filter((r): r is NonNullable<typeof r> => r !== null)
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
      offlineRevenue: r.offline.reduce((s: number, v: { revenue: number }) => s + v.revenue, 0),
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

export default async function InsightsPage() {
  const { months, totals } = await getOverviewData();

  if (months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <p className="text-lg">데이터가 없습니다.</p>
        <p className="text-sm mt-1">
          월별 대시보드에서 먼저 데이터를 수집해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">인사이트</h2>
        <p className="text-sm text-gray-400 mt-1">
          {months[0].label} ~ {months[months.length - 1].label} ·{" "}
          {months.length}개월
        </p>
      </div>

      {/* 누적 stat cards */}
      <OverviewStatCards totals={totals} monthCount={months.length} />

      {/* 차트 */}
      <ChartsSection data={months} />
    </div>
  );
}
