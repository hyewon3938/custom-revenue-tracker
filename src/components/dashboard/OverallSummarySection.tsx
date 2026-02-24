import { OverallSummary } from "@/lib/types";

const krw = (n: number) =>
  n.toLocaleString("ko-KR", { style: "currency", currency: "KRW" });

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
      className={`rounded-xl border p-5 ${highlight ? "bg-blue-600 border-blue-500 text-white" : "bg-white border-gray-200"}`}
    >
      <p className={`text-sm ${highlight ? "text-blue-100" : "text-gray-500"}`}>
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? "text-white" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-1 ${highlight ? "text-blue-200" : "text-gray-400"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-700">{krw(value)}</span>
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
        <StatCard label="총 매출" value={krw(summary.totalRevenue)} />
        <StatCard label="총 이익" value={krw(summary.totalProfit)} />
        <StatCard label="부자재비" value={krw(summary.totalMaterialCost)} />
        <StatCard
          label="순이익"
          value={krw(summary.totalNetProfit)}
          sub={`마진율 ${marginRate}%`}
          highlight
        />
      </div>

      {/* 비용 내역 + 판매량 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">비용 내역</p>
          <CostRow label="플랫폼 수수료" value={summary.totalCommissionFee} />
          <CostRow label="물류비" value={summary.totalLogisticsFee} />
          <CostRow label="광고비" value={summary.totalAdFee} />
          <div className="flex justify-between items-center pt-2 mt-1">
            <span className="text-sm font-semibold text-gray-700">합계</span>
            <span className="text-sm font-bold text-gray-900">
              {krw(
                summary.totalCommissionFee +
                  summary.totalLogisticsFee +
                  summary.totalAdFee
              )}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">판매량</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">전체</span>
              <span className="text-sm font-bold text-gray-900">
                {summary.totalQuantity.toLocaleString()}개
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">끈갈피</span>
              <span className="text-sm font-semibold">
                {summary.handmadeQuantity.toLocaleString()}개
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">기타</span>
              <span className="text-sm font-semibold">
                {summary.otherQuantity.toLocaleString()}개
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
