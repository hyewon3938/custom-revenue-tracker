import StatCard from "@/components/ui/StatCard";
import KRWText from "@/components/ui/KRWText";
import QtyText from "@/components/ui/QtyText";

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
        value={<QtyText n={totals.totalQuantity} />}
        sub={`${monthCount}개월 누적`}
      />
      <StatCard
        label="누적 끈갈피 판매수"
        value={<QtyText n={totals.handmadeQuantity} />}
        sub={`전체의 ${totals.totalQuantity > 0 ? Math.round((totals.handmadeQuantity / totals.totalQuantity) * 100) : 0}%`}
      />
      <StatCard
        label="누적 매출"
        value={<KRWText n={totals.totalRevenue} />}
      />
      <StatCard
        label="누적 순이익"
        value={<KRWText n={totals.totalNetProfit} />}
        sub={`평균 마진율 ${overallMargin}%`}
        highlight
      />
    </div>
  );
}
