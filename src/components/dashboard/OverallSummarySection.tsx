import { OverallSummary } from "@/lib/types";
import Card from "@/components/ui/Card";
import Row from "@/components/ui/Row";
import StatCard from "@/components/ui/StatCard";
import KRWText from "@/components/ui/KRWText";
import QtyText from "@/components/ui/QtyText";

export default function OverallSummarySection({
  summary,
}: {
  summary: OverallSummary;
}) {
  const marginRate =
    summary.totalRevenue > 0
      ? ((summary.totalNetProfit / summary.totalRevenue) * 100).toFixed(1)
      : "0.0";

  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">전체 요약</h3>

      {/* 핵심 지표 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="총 매출" value={<KRWText n={summary.totalRevenue} />} />
        <StatCard label="총 이익" value={<KRWText n={summary.totalProfit} />} />
        <StatCard label="부자재비" value={<KRWText n={summary.totalMaterialCost} />} />
        <StatCard
          label="순이익"
          value={<KRWText n={summary.totalNetProfit} />}
          sub={`마진율 ${marginRate}%`}
          highlight
        />
      </div>

      {/* 비용 내역 + 판매량 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm font-medium text-gray-700 mb-3">비용 내역</p>
          <Row label="플랫폼 수수료" value={<KRWText n={summary.totalCommissionFee} />} />
          <Row label="물류비" value={<KRWText n={summary.totalLogisticsFee} />} />
          <Row label="광고비" value={<KRWText n={summary.totalAdFee} />} />
          {(summary.marketingCost ?? 0) > 0 && (
            <Row label="마케팅 비용" value={<KRWText n={summary.marketingCost} />} />
          )}
          <div className="flex justify-between items-center pt-2 mt-1">
            <span className="text-sm font-semibold text-gray-700">합계</span>
            <span className="text-sm font-bold text-gray-900">
              <KRWText
                n={
                  summary.totalCommissionFee +
                  summary.totalLogisticsFee +
                  summary.totalAdFee +
                  (summary.marketingCost ?? 0)
                }
              />
            </span>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium text-gray-700 mb-3">판매량</p>
          <Row
            label="전체"
            value={<QtyText n={summary.totalQuantity} />}
            valueClassName="text-sm font-bold text-gray-900"
          />
          <Row label="끈갈피" value={<QtyText n={summary.handmadeQuantity} />} />
          <Row label="기타" value={<QtyText n={summary.otherQuantity} />} border={false} />
        </Card>
      </div>
    </section>
  );
}
