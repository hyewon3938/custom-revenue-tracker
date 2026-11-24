import { NaverData } from "@/lib/types";
import Card from "@/components/ui/Card";
import Row from "@/components/ui/Row";
import KRWText from "@/components/ui/KRWText";
import ProfitBlock from "./ProfitBlock";

export default function NaverCard({ data }: { data: NaverData }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">네이버 스마트스토어</h4>
        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
          N
        </span>
      </div>

      <Row label="매출" value={<KRWText n={data.revenue} />} />
      <Row label="정산금" value={<KRWText n={data.fees.settlementAmount} />} />
      <Row label="수수료" value={<KRWText n={data.fees.commissionFee} />} />
      <Row label="배송비" value={<KRWText n={data.fees.logisticsFee} />} />

      <ProfitBlock profit={data.profit} className="mt-2 pt-1" />

      <div className="mt-3 pt-3 border-t border-warm-100">
        <p className="text-xs text-gray-400 mb-1.5">판매량</p>
        <p className="text-sm text-gray-700">
          전체 {data.totalQuantity}개 · 끈갈피 {data.handmadeQuantity}개
        </p>
        {data.shippingStats.regularCount + data.shippingStats.freeCount > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            일반배송 {data.shippingStats.regularCount}건 · 무료배송{" "}
            {data.shippingStats.freeCount}건
          </p>
        )}
      </div>
    </Card>
  );
}
