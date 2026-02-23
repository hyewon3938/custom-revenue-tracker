import { MonthlyReport } from "@/lib/types";

interface Props {
  report: MonthlyReport;
}

const formatKRW = (n: number) =>
  n.toLocaleString("ko-KR", { style: "currency", currency: "KRW" });

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// TODO: UI 상세 구현 예정
export default function SalesSummary({ report }: Props) {
  const { naver, coupang, offline, profit } = report;
  const total = profit.totalRevenue;

  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">전체 요약</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="최종 매출" value={formatKRW(total)} />
        <StatCard label="순이익" value={formatKRW(profit.netProfit)} />
        <StatCard
          label="네이버 매출"
          value={formatKRW(naver.revenue)}
          sub={total > 0 ? `전체의 ${((naver.revenue / total) * 100).toFixed(1)}%` : undefined}
        />
        <StatCard
          label="쿠팡 매출"
          value={formatKRW(coupang.revenue)}
          sub={total > 0 ? `전체의 ${((coupang.revenue / total) * 100).toFixed(1)}%` : undefined}
        />
        <StatCard label="오프라인 매출" value={formatKRW(offline.revenue)} />
        <StatCard label="재료비 (15%)" value={formatKRW(profit.materialCost)} />
        <StatCard label="플랫폼 비용" value={formatKRW(profit.platformFees)} />
        <StatCard label="최종 이익" value={formatKRW(profit.grossProfit)} />
      </div>
    </section>
  );
}
