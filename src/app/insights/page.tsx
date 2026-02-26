import { listReports, loadReport } from "@/lib/storage/report-store";
import { buildOverviewData } from "@/lib/calculations/overview";
import OverviewStatCards from "@/components/insights/OverviewStatCards";
import ChartsSection from "@/components/insights/ChartsSection";

async function getOverviewData() {
  const list = await listReports();
  const results = await Promise.all(
    list.map(({ year, month }) => loadReport(year, month))
  );
  const reports = results.filter(
    (r): r is NonNullable<typeof r> => r !== null
  );
  return buildOverviewData(reports);
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
