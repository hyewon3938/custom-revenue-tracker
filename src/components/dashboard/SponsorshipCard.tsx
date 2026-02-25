"use client";

import { useCallback } from "react";
import { SponsorshipData, SponsoredItem, ProductMatrixRow } from "@/lib/types";
import { formatKRW as krw } from "@/lib/utils/format";
import EditableField from "./EditableField";
import ProductQtyEditor from "./ProductQtyEditor";

// ─── 마케팅 비용 EditRow ────────────────────────────────────────────────────

function EditRow({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (v: number) => Promise<void>;
}) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">
        {label} <span className="text-xs text-blue-400">(수기)</span>
      </span>
      <EditableField value={value} onSave={onSave} />
    </div>
  );
}

// ─── 협찬 마케팅 카드 ───────────────────────────────────────────────────────

interface Props {
  sponsorship: SponsorshipData;
  productMatrix: ProductMatrixRow[];
  onUpdate: (patch: object) => Promise<void>;
}

export default function SponsorshipCard({ sponsorship, productMatrix, onUpdate }: Props) {
  const saveItems = useCallback(
    async (quantities: Record<string, number>) => {
      const items: SponsoredItem[] = productMatrix
        .filter((row) => (quantities[row.productName] ?? 0) > 0)
        .map((row) => ({
          productName: row.productName,
          category: row.category,
          quantity: quantities[row.productName],
        }));
      await onUpdate({ sponsorship: { items } });
    },
    [productMatrix, onUpdate]
  );

  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">협찬 마케팅</h3>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-gray-900">협찬 현황</h4>
          <span className="text-xs font-bold bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">
            협찬
          </span>
        </div>

        {/* 마케팅 비용 */}
        <EditRow
          label="마케팅 비용"
          value={sponsorship.marketingCost}
          onSave={(v) => onUpdate({ sponsorship: { marketingCost: v } })}
        />

        {sponsorship.marketingCost > 0 && (
          <p className="text-xs text-gray-400 mt-1 mb-2">
            순이익에서 {krw(sponsorship.marketingCost)} 차감됩니다.
          </p>
        )}

        {/* 협찬 상품 수량 편집기 */}
        <ProductQtyEditor
          label="협찬 상품"
          savedItems={sponsorship.items}
          editList={productMatrix}
          totalQuantity={sponsorship.totalQuantity}
          handmadeQuantity={sponsorship.handmadeQuantity}
          summaryPrefix="총 제공량"
          onSave={saveItems}
        />
      </div>
    </section>
  );
}
