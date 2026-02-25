"use client";

import { useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import {
  NaverData,
  CoupangData,
  OfflineData,
  ProductMatrixRow,
  ProductSales,
} from "@/lib/types";
import KRWText from "@/components/ui/KRWText";
import EditableField from "./EditableField";
import ProductQtyEditor from "./ProductQtyEditor";
import VenueModal from "./VenueModal";

// ─── 공통 Row 컴포넌트 ─────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-warm-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

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
    <div className="flex justify-between items-center py-1.5">
      <span className="text-sm text-gray-500">
        {label} <span className="text-xs text-brand-400">(수기)</span>
      </span>
      <EditableField value={value} onSave={onSave} />
    </div>
  );
}

function NetProfitRow({ value }: { value: number }) {
  return (
    <div className="flex justify-between items-center pt-2">
      <span className="text-sm font-semibold text-gray-700">순이익</span>
      <span
        className={`text-sm font-bold ${
          value >= 0 ? "text-brand-500" : "text-red-500"
        }`}
      >
        <KRWText n={value} />
      </span>
    </div>
  );
}

// ─── 네이버 카드 ────────────────────────────────────────────────────────────

function NaverCard({
  data,
  onUpdate,
}: {
  data: NaverData;
  onUpdate: (patch: object) => Promise<void>;
}) {
  return (
    <div className="bg-white rounded-xl border border-warm-200 p-5">
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
      <EditRow
        label="광고비"
        value={data.fees.adFee}
        onSave={(v) => onUpdate({ naver: { fees: { adFee: v } } })}
      />

      <div className="mt-3 pt-3 border-t border-warm-100">
        <Row label="이익" value={<KRWText n={data.profit.profit} />} />
        <Row
          label="부자재비"
          value={<KRWText n={data.profit.materialCost} />}
        />
        <NetProfitRow value={data.profit.netProfit} />
      </div>

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
    </div>
  );
}

// ─── 쿠팡 카드 ─────────────────────────────────────────────────────────────

/** 쿠팡 데이터 제공 시작: 2025년 3월. 그 이전 월은 판매량 수기 입력 모드. */
function isCoupangManual(year: number, month: number) {
  return year < 2025 || (year === 2025 && month < 3);
}

function CoupangCard({
  data,
  year,
  month,
  productMatrix,
  onUpdate,
}: {
  data: CoupangData;
  year: number;
  month: number;
  productMatrix: ProductMatrixRow[];
  onUpdate: (patch: object) => Promise<void>;
}) {
  const isManual = isCoupangManual(year, month);

  // 수기 모드: productMatrix에 없는 기존 쿠팡 상품도 포함
  const editList = useMemo(() => {
    if (!isManual) return [];
    const knownNames = new Set(productMatrix.map((r) => r.productName));
    const extras: ProductMatrixRow[] = data.products
      .filter((p) => !knownNames.has(p.productName))
      .map((p) => ({
        productName: p.productName,
        category: p.category,
        naver: 0,
        coupang: p.quantity,
        offline: 0,
        total: p.quantity,
      }));
    return [...productMatrix, ...extras];
  }, [isManual, productMatrix, data.products]);

  const saveProducts = useCallback(
    async (quantities: Record<string, number>) => {
      const products: ProductSales[] = editList
        .filter((row) => (quantities[row.productName] ?? 0) > 0)
        .map((row) => ({
          productName: row.productName,
          category: row.category,
          platform: "coupang" as const,
          quantity: quantities[row.productName],
        }));
      await onUpdate({ coupang: { products } });
    },
    [editList, onUpdate]
  );

  return (
    <div className="bg-white rounded-xl border border-warm-200 p-5">
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
      <Row label="광고비" value={<KRWText n={data.fees.adFee} />} />

      <div className="mt-3 pt-3 border-t border-warm-100">
        <Row label="이익" value={<KRWText n={data.profit.profit} />} />
        <Row
          label="부자재비"
          value={<KRWText n={data.profit.materialCost} />}
        />
        <NetProfitRow value={data.profit.netProfit} />
      </div>

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
    </div>
  );
}

// ─── 오프라인 카드 ──────────────────────────────────────────────────────────

function OfflineCard({
  data,
  productMatrix,
  onUpdate,
}: {
  data: OfflineData;
  productMatrix: ProductMatrixRow[];
  onUpdate: (patch: object) => Promise<void>;
}) {
  const saveProducts = useCallback(
    async (quantities: Record<string, number>) => {
      const products: ProductSales[] = productMatrix
        .filter((row) => (quantities[row.productName] ?? 0) > 0)
        .map((row) => ({
          productName: row.productName,
          category: row.category,
          platform: "offline" as const,
          quantity: quantities[row.productName],
        }));
      await onUpdate({ offline: { products } });
    },
    [productMatrix, onUpdate]
  );

  return (
    <div className="bg-white rounded-xl border border-warm-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">{data.venueName}</h4>
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

      <div className="mt-3 pt-3 border-t border-warm-100">
        <Row label="이익" value={<KRWText n={data.profit.profit} />} />
        <Row
          label="부자재비"
          value={<KRWText n={data.profit.materialCost} />}
        />
        <NetProfitRow value={data.profit.netProfit} />
      </div>

      <ProductQtyEditor
        label="판매량"
        savedItems={data.products}
        editList={productMatrix}
        totalQuantity={data.totalQuantity}
        handmadeQuantity={data.handmadeQuantity}
        summaryPrefix="전체"
        onSave={saveProducts}
      />
    </div>
  );
}

// ─── 메인 섹션 ──────────────────────────────────────────────────────────────

interface Props {
  year: number;
  month: number;
  naver: NaverData;
  coupang: CoupangData;
  offline: OfflineData[];
  productMatrix: ProductMatrixRow[];
  onUpdate: (patch: object) => Promise<void>;
}

export default function PlatformSection({
  year,
  month,
  naver,
  coupang,
  offline,
  productMatrix,
  onUpdate,
}: Props) {
  const [venueModalOpen, setVenueModalOpen] = useState(false);

  // 카드 수에 따른 그리드 레이아웃
  // 3개: 한 줄 3등분 / 4개: 한 줄 4등분 / 5개+: 한 줄 3개씩
  const totalCards = 2 + offline.length;
  const gridCols =
    totalCards <= 2
      ? "grid-cols-1 md:grid-cols-2"
      : totalCards === 3
        ? "grid-cols-1 md:grid-cols-3"
        : totalCards === 4
          ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
          : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          플랫폼별 매출 · 비용
        </h3>
        <button
          onClick={() => setVenueModalOpen(true)}
          className="text-sm text-brand-500 hover:text-brand-600 font-medium transition-colors"
        >
          플랫폼 관리
        </button>
      </div>
      <div className={`grid ${gridCols} gap-4`}>
        <NaverCard data={naver} onUpdate={onUpdate} />
        <CoupangCard
          data={coupang}
          year={year}
          month={month}
          productMatrix={productMatrix}
          onUpdate={onUpdate}
        />
        {offline.map((venue) => (
          <OfflineCard
            key={venue.venueId}
            data={venue}
            productMatrix={productMatrix}
            onUpdate={async (patch: object) => {
              await onUpdate({ ...(patch as Record<string, unknown>), offlineVenueId: venue.venueId });
            }}
          />
        ))}
      </div>
      <VenueModal
        isOpen={venueModalOpen}
        onClose={() => setVenueModalOpen(false)}
        activeVenues={offline}
        year={year}
        month={month}
        onUpdate={onUpdate}
      />
    </section>
  );
}
