import { formatKRW as krw } from "@/lib/utils/format";

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? "bg-blue-600 border-blue-500 text-white"
          : "bg-white border-gray-200"
      }`}
    >
      <p className={`text-sm ${highlight ? "text-blue-100" : "text-gray-500"}`}>
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
            highlight ? "text-blue-200" : "text-gray-400"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

interface Props {
  totals: {
    totalQuantity: number;
    handmadeQuantity: number;
    totalRevenue: number;
    totalNetProfit: number;
  };
  monthCount: number;
}

export default function OverviewStatCards({ totals, monthCount }: Props) {
  const overallMargin =
    totals.totalRevenue > 0
      ? ((totals.totalNetProfit / totals.totalRevenue) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="누적 총 판매수"
        value={`${totals.totalQuantity.toLocaleString()}개`}
        sub={`${monthCount}개월 누적`}
      />
      <StatCard
        label="누적 끈갈피 판매수"
        value={`${totals.handmadeQuantity.toLocaleString()}개`}
        sub={`전체의 ${totals.totalQuantity > 0 ? Math.round((totals.handmadeQuantity / totals.totalQuantity) * 100) : 0}%`}
      />
      <StatCard
        label="누적 매출"
        value={krw(totals.totalRevenue)}
      />
      <StatCard
        label="누적 순이익"
        value={krw(totals.totalNetProfit)}
        sub={`평균 마진율 ${overallMargin}%`}
        highlight
      />
    </div>
  );
}
