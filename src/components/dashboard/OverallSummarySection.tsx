import { OverallSummary } from "@/lib/types";
import StatCard from "@/components/ui/StatCard";
import KRWText from "@/components/ui/KRWText";
import QtyText from "@/components/ui/QtyText";

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-warm-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-700">
        <KRWText n={value} />
      </span>
    </div>
  );
}

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
        <div className="bg-white rounded-xl border border-warm-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">비용 내역</p>
          <CostRow label="플랫폼 수수료" value={summary.totalCommissionFee} />
          <CostRow label="물류비" value={summary.totalLogisticsFee} />
          <CostRow label="광고비" value={summary.totalAdFee} />
          {(summary.marketingCost ?? 0) > 0 && (
            <CostRow label="마케팅 비용" value={summary.marketingCost} />
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
        </div>

        <div className="bg-white rounded-xl border border-warm-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">판매량</p>
          <div>
            <div className="flex justify-between items-center py-1.5 border-b border-warm-100">
              <span className="text-sm text-gray-500">전체</span>
              <span className="text-sm font-bold text-gray-900">
                <QtyText n={summary.totalQuantity} />
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-warm-100">
              <span className="text-sm text-gray-500">끈갈피</span>
              <span className="text-sm font-semibold">
                <QtyText n={summary.handmadeQuantity} />
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm text-gray-500">기타</span>
              <span className="text-sm font-semibold">
                <QtyText n={summary.otherQuantity} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
