"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  NaverData,
  CoupangData,
  OfflineData,
  ProductMatrixRow,
  ProductSales,
} from "@/lib/types";
import { formatKRW as krw } from "@/lib/utils/format";
import EditableField from "./EditableField";

// ─── 공통 Row 컴포넌트 ─────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
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
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">
        {label} <span className="text-xs text-blue-400">(수기)</span>
      </span>
      <EditableField value={value} onSave={onSave} />
    </div>
  );
}

function NetProfitRow({ value }: { value: number }) {
  return (
    <div className="flex justify-between items-center pt-2">
      <span className="text-sm font-semibold text-gray-700">순이익</span>
      <span className={`text-sm font-bold ${value >= 0 ? "text-blue-600" : "text-red-500"}`}>
        {krw(value)}
      </span>
    </div>
  );
}

// ─── 상품별 수량 수기 편집 (쿠팡 수기 모드 + 오프라인 공통) ─────────────────
//
// CoupangCard(수기 모드)와 OfflineCard에서 동일하게 쓰이는
// 토글 + 수량 입력 + blur-on-save 로직을 단일 컴포넌트로 통합.

function ProductQtyEditor({
  savedProducts,
  editList,
  totalQuantity,
  handmadeQuantity,
  platform,
  onSave,
}: {
  savedProducts: ProductSales[];
  editList: ProductMatrixRow[];
  totalQuantity: number;
  handmadeQuantity: number;
  platform: "coupang" | "offline";
  onSave: (products: ProductSales[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(savedProducts.map((p) => [p.productName, p.quantity]))
  );

  // 부모 데이터 갱신 시 로컬 수량 동기화
  useEffect(() => {
    setQuantities(Object.fromEntries(savedProducts.map((p) => [p.productName, p.quantity])));
  }, [savedProducts]);

  const sorted = useMemo(
    () => [...editList].sort((a, b) => a.productName.localeCompare(b.productName, "ko")),
    [editList]
  );

  const handleSave = useCallback(
    async (next: Record<string, number>) => {
      const products: ProductSales[] = sorted
        .filter((row) => (next[row.productName] ?? 0) > 0)
        .map((row) => ({
          productName: row.productName,
          category: row.category,
          platform,
          quantity: next[row.productName],
        }));
      await onSave(products);
    },
    [sorted, platform, onSave]
  );

  const handleBlur = useCallback(
    (name: string, value: number) => {
      const prev = savedProducts.find((p) => p.productName === name)?.quantity ?? 0;
      if (value !== prev) handleSave({ ...quantities, [name]: value });
    },
    [savedProducts, quantities, handleSave]
  );

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {sorted.length > 0 ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-between w-full text-left mb-1.5"
        >
          <span className="text-xs text-gray-400">
            판매량 <span className="text-blue-400">(수기)</span>
          </span>
          <svg
            className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <p className="text-xs text-gray-400 mb-1.5">판매량</p>
      )}

      <p className="text-sm text-gray-700">
        전체 {totalQuantity}개 · 끈갈피 {handmadeQuantity}개
      </p>

      {open && sorted.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {sorted.map((row) => (
            <div key={row.productName} className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-600 truncate" title={row.productName}>
                {row.productName}
              </span>
              <input
                type="number"
                min="0"
                value={quantities[row.productName] ?? 0}
                onChange={(e) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [row.productName]: Math.max(0, Number(e.target.value)),
                  }))
                }
                onBlur={(e) => handleBlur(row.productName, Math.max(0, Number(e.target.value)))}
                className="w-16 shrink-0 text-right text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>
          ))}
        </div>
      )}
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
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">네이버 스마트스토어</h4>
        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">N</span>
      </div>

      <Row label="매출" value={krw(data.revenue)} />
      <Row label="정산금" value={krw(data.fees.settlementAmount)} />
      <Row label="수수료" value={krw(data.fees.commissionFee)} />
      <Row label="물류비" value={krw(data.fees.logisticsFee)} />
      <EditRow
        label="광고비"
        value={data.fees.adFee}
        onSave={(v) => onUpdate({ naver: { fees: { adFee: v } } })}
      />

      <div className="mt-3 pt-3 border-t border-gray-100">
        <Row label="이익" value={krw(data.profit.profit)} />
        <Row label="부자재비" value={krw(data.profit.materialCost)} />
        <NetProfitRow value={data.profit.netProfit} />
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1.5">판매량</p>
        <p className="text-sm text-gray-700">
          전체 {data.totalQuantity}개 · 끈갈피 {data.handmadeQuantity}개
        </p>
        {(data.shippingStats.regularCount + data.shippingStats.freeCount) > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            일반배송 {data.shippingStats.regularCount}건 · 무료배송 {data.shippingStats.freeCount}건
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

  // 수기 모드: productMatrix에 없는 기존 쿠팡 상품(예: 이전 스크래핑 잔여 데이터)도 포함
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

  const handleSave = useCallback(
    (products: ProductSales[]) => onUpdate({ coupang: { products } }),
    [onUpdate]
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">쿠팡</h4>
        <div className="flex items-center gap-1.5">
          {isManual && (
            <span className="text-xs font-medium bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">
              수기
            </span>
          )}
          <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">C</span>
        </div>
      </div>

      <Row label="매출" value={krw(data.revenue)} />
      <Row label="판매수수료" value={krw(data.fees.commissionFee)} />
      <Row label="풀필먼트 물류비" value={krw(data.fees.logisticsFee)} />
      <Row label="광고비" value={krw(data.fees.adFee)} />

      <div className="mt-3 pt-3 border-t border-gray-100">
        <Row label="이익" value={krw(data.profit.profit)} />
        <Row label="부자재비" value={krw(data.profit.materialCost)} />
        <NetProfitRow value={data.profit.netProfit} />
      </div>

      {isManual ? (
        <ProductQtyEditor
          savedProducts={data.products}
          editList={editList}
          totalQuantity={data.totalQuantity}
          handmadeQuantity={data.handmadeQuantity}
          platform="coupang"
          onSave={handleSave}
        />
      ) : (
        <div className="mt-3 pt-3 border-t border-gray-100">
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
  const handleSave = useCallback(
    (products: ProductSales[]) => onUpdate({ offline: { products } }),
    [onUpdate]
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">{data.venueName}</h4>
        <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">OFF</span>
      </div>

      <EditRow label="매출" value={data.revenue} onSave={(v) => onUpdate({ offline: { revenue: v } })} />
      <EditRow label="입점 수수료" value={data.fees.commissionFee} onSave={(v) => onUpdate({ offline: { fees: { commissionFee: v } } })} />
      <EditRow label="물류비" value={data.fees.logisticsFee} onSave={(v) => onUpdate({ offline: { fees: { logisticsFee: v } } })} />
      <EditRow label="광고비" value={data.fees.adFee} onSave={(v) => onUpdate({ offline: { fees: { adFee: v } } })} />

      <div className="mt-3 pt-3 border-t border-gray-100">
        <Row label="이익" value={krw(data.profit.profit)} />
        <Row label="부자재비" value={krw(data.profit.materialCost)} />
        <NetProfitRow value={data.profit.netProfit} />
      </div>

      <ProductQtyEditor
        savedProducts={data.products}
        editList={productMatrix}
        totalQuantity={data.totalQuantity}
        handmadeQuantity={data.handmadeQuantity}
        platform="offline"
        onSave={handleSave}
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
  offline: OfflineData;
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
  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-800 mb-3">플랫폼별 매출 · 비용</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NaverCard data={naver} onUpdate={onUpdate} />
        <CoupangCard data={coupang} year={year} month={month} productMatrix={productMatrix} onUpdate={onUpdate} />
        <OfflineCard data={offline} productMatrix={productMatrix} onUpdate={onUpdate} />
      </div>
    </section>
  );
}
