"use client";

import { useCallback, useMemo } from "react";
import { CoupangData, ProductMatrixRow } from "@/lib/types";
import {
  isCoupangManual,
  buildCoupangEditList,
  toProductSales,
} from "@/lib/calculations/platform-edit";
import Card from "@/components/ui/Card";
import Row from "@/components/ui/Row";
import EditRow from "@/components/ui/EditRow";
import KRWText from "@/components/ui/KRWText";
import ProductQtyEditor from "../ProductQtyEditor";
import ProfitBlock from "./ProfitBlock";

interface Props {
  data: CoupangData;
  year: number;
  month: number;
  productMatrix: ProductMatrixRow[];
  onUpdate: (patch: object) => Promise<void>;
}

export default function CoupangCard({
  data,
  year,
  month,
  productMatrix,
  onUpdate,
}: Props) {
  const isManual = isCoupangManual(year, month);

  // 수기 모드: productMatrix에 없는 기존 쿠팡 상품도 포함
  const editList = useMemo(
    () => buildCoupangEditList(isManual, productMatrix, data.products),
    [isManual, productMatrix, data.products],
  );

  const saveProducts = useCallback(
    async (quantities: Record<string, number>) => {
      const products = toProductSales(editList, quantities, "coupang");
      await onUpdate({ coupang: { products } });
    },
    [editList, onUpdate],
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">쿠팡</h4>
        <div className="flex items-center gap-1.5">
          {isManual && (
            <span className="text-xs font-medium bg-brand-50 text-brand-500 px-2 py-0.5 rounded-full">
              수기
            </span>
          )}
          <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
            C
          </span>
        </div>
      </div>

      <Row label="매출" value={<KRWText n={data.revenue} />} />
      <Row label="판매수수료" value={<KRWText n={data.fees.commissionFee} />} />
      <Row
        label="풀필먼트 물류비"
        value={<KRWText n={data.fees.logisticsFee} />}
      />
      <EditRow
        label="입고 배송비"
        value={data.fees.inboundShippingFee}
        onSave={(v) =>
          onUpdate({ coupang: { fees: { inboundShippingFee: v } } })
        }
      />
      <Row label="광고비" value={<KRWText n={data.fees.adFee} />} />

      <ProfitBlock profit={data.profit} className="mt-2 pt-1" />

      {isManual ? (
        <ProductQtyEditor
          label="판매량"
          savedItems={data.products}
          editList={editList}
          totalQuantity={data.totalQuantity}
          handmadeQuantity={data.handmadeQuantity}
          summaryPrefix="전체"
          onSave={saveProducts}
        />
      ) : (
        <div className="mt-3 pt-3 border-t border-warm-100">
          <p className="text-xs text-gray-400 mb-1.5">판매량</p>
          <p className="text-sm text-gray-700">
            전체 {data.totalQuantity}개 · 끈갈피 {data.handmadeQuantity}개
          </p>
        </div>
      )}
    </Card>
  );
}
