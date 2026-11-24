"use client";

import { useCallback } from "react";
import { OfflineData, ProductMatrixRow } from "@/lib/types";
import { toProductSales } from "@/lib/calculations/platform-edit";
import { GOSAN_VENUE_ID } from "@/lib/constants";
import Card from "@/components/ui/Card";
import EditRow from "@/components/ui/EditRow";
import ProductQtyEditor from "../ProductQtyEditor";
import GosanTooltip from "./GosanTooltip";
import ProfitBlock from "./ProfitBlock";

interface Props {
  data: OfflineData;
  productMatrix: ProductMatrixRow[];
  onUpdate: (patch: object) => Promise<void>;
}

export default function OfflineCard({ data, productMatrix, onUpdate }: Props) {
  const saveProducts = useCallback(
    async (quantities: Record<string, number>) => {
      const products = toProductSales(productMatrix, quantities, "offline");
      await onUpdate({ offline: { products } });
    },
    [productMatrix, onUpdate],
  );

  const isGosan = data.venueId === GOSAN_VENUE_ID;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <h4 className="font-semibold text-gray-900">{data.venueName}</h4>
          {isGosan && <GosanTooltip />}
        </div>
        <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
          OFF
        </span>
      </div>

      <EditRow
        label="매출"
        value={data.revenue}
        onSave={(v) => onUpdate({ offline: { revenue: v } })}
      />
      <EditRow
        label="입점 수수료"
        value={data.fees.commissionFee}
        onSave={(v) => onUpdate({ offline: { fees: { commissionFee: v } } })}
      />
      <EditRow
        label="입고 배송비"
        value={data.fees.logisticsFee}
        onSave={(v) => onUpdate({ offline: { fees: { logisticsFee: v } } })}
      />
      <EditRow
        label="광고비"
        value={data.fees.adFee}
        onSave={(v) => onUpdate({ offline: { fees: { adFee: v } } })}
      />

      <ProfitBlock
        profit={data.profit}
        className="mt-3 pt-3 border-t border-warm-100"
      />

      <ProductQtyEditor
        label="판매량"
        savedItems={data.products}
        editList={productMatrix}
        totalQuantity={data.totalQuantity}
        handmadeQuantity={data.handmadeQuantity}
        summaryPrefix="전체"
        onSave={saveProducts}
      />
    </Card>
  );
}
