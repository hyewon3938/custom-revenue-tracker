"use client";

import { useCallback } from "react";
import { SponsorshipData, SponsoredItem, ProductMatrixRow } from "@/lib/types";
import Card from "@/components/ui/Card";
import EditRow from "@/components/ui/EditRow";
import SponsorItemEditor from "./SponsorItemEditor";

interface Props {
  sponsorship: SponsorshipData;
  productMatrix: ProductMatrixRow[];
  onUpdate: (patch: object) => Promise<void>;
}

export default function SponsorshipCard({
  sponsorship,
  productMatrix,
  onUpdate,
}: Props) {
  const hasUnitPrices =
    sponsorship.items.length > 0 &&
    sponsorship.items.every((i) => i.unitPrice != null && i.unitPrice > 0);

  const saveItems = useCallback(
    async (items: SponsoredItem[]) => {
      await onUpdate({ sponsorship: { items } });
    },
    [onUpdate],
  );

  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">협찬 마케팅</h3>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900">협찬 현황</h4>
          <span className="text-xs font-bold bg-warm-200 text-warm-700 px-2 py-0.5 rounded-full">
            협찬
          </span>
        </div>

        {/* 마케팅 비용 — 단가 입력 완료 시 자동, 아니면 수기 */}
        {hasUnitPrices ? (
          <div className="flex justify-between items-center py-1.5">
            <span className="text-sm text-gray-500">
              마케팅 비용 <span className="text-xs text-brand-400">(자동)</span>
            </span>
            <span className="text-sm font-semibold text-gray-800">
              {sponsorship.marketingCost.toLocaleString("ko-KR")}원
            </span>
          </div>
        ) : (
          <EditRow
            label="마케팅 비용"
            value={sponsorship.marketingCost}
            onSave={(v) => onUpdate({ sponsorship: { marketingCost: v } })}
          />
        )}

        {sponsorship.marketingCost > 0 && (
          <p className="text-xs text-gray-400 mt-1 mb-3">
            순이익에서 {sponsorship.marketingCost.toLocaleString("ko-KR")}원
            차감됩니다.
          </p>
        )}

        {/* 계산식 툴팁 */}
        <div className="bg-warm-50 rounded-lg px-3 py-2.5 mb-1">
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-medium">협찬 비용 계산:</span> (단가 + 배송비
            3,000) × 1.1 (VAT 포함)
          </p>
          <p className="text-xs text-gray-400 mt-1">
            매출에 잡힌 협찬 분을 순이익에서 환불 처리합니다. 정산
            수수료·부자재비·배송비 차액은 자동 계산에서 별도 차감되어 중복되지
            않습니다.
          </p>
        </div>

        {/* 협찬 상품 편집기 — 수량 + 단가 입력 */}
        <SponsorItemEditor
          savedItems={sponsorship.items}
          editList={productMatrix}
          totalQuantity={sponsorship.totalQuantity}
          handmadeQuantity={sponsorship.handmadeQuantity}
          onSave={saveItems}
        />
      </Card>
    </section>
  );
}
