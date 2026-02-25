"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ProductMatrixRow } from "@/lib/types";

// ─── hover + focus 하이라이트 입력 행 ───────────────────────────────────────

export function InputRow({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onBlur: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className="flex items-center justify-between gap-3 px-2 py-1.5 -mx-2 rounded-lg transition-colors"
      style={{ backgroundColor: focused ? "#eff6ff" : undefined }}
      onMouseEnter={(e) => {
        if (!focused) e.currentTarget.style.backgroundColor = "#f8fafc";
      }}
      onMouseLeave={(e) => {
        if (!focused) e.currentTarget.style.backgroundColor = "";
      }}
    >
      <span
        className="text-xs truncate flex-1 transition-colors"
        style={{ color: focused ? "#2563eb" : "#4b5563" }}
        title={label}
      >
        {label}
      </span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          onBlur(Math.max(0, Number(e.target.value)));
        }}
        className="w-16 shrink-0 text-right text-xs border rounded px-2 py-1 focus:outline-none transition-colors"
        style={{ borderColor: focused ? "#60a5fa" : "#e5e7eb" }}
      />
    </div>
  );
}

// ─── 상품 수량 편집기 (공통) ─────────────────────────────────────────────────
//
// PlatformSection(쿠팡 수기 모드, 오프라인)과 SponsorshipCard(협찬 상품) 공통.
// onSave 콜백으로 Record<productName, quantity> 를 전달 — 부모에서 원하는 타입으로 변환.

interface SavedItem {
  productName: string;
  quantity: number;
}

interface Props {
  /** 섹션 레이블 ("판매량" | "협찬 상품") */
  label: string;
  /** 현재 저장된 상품·수량 (수량 동기화 및 변경 감지에 사용) */
  savedItems: SavedItem[];
  /** 편집 가능한 전체 상품 목록 */
  editList: ProductMatrixRow[];
  totalQuantity: number;
  handmadeQuantity: number;
  /** 합계 라인 앞 접두어 ("전체" | "총 제공량") */
  summaryPrefix: string;
  /** 저장된 아이템을 접혀 있어도 위에 항상 표시 (협찬용) */
  showSummaryList?: boolean;
  /** blur 시 변경이 있을 때 호출 — 전체 Record<productName, quantity> 전달 */
  onSave: (quantities: Record<string, number>) => Promise<void>;
}

export default function ProductQtyEditor({
  label,
  savedItems,
  editList,
  totalQuantity,
  handmadeQuantity,
  summaryPrefix,
  showSummaryList = false,
  onSave,
}: Props) {
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(savedItems.map((i) => [i.productName, i.quantity]))
  );

  // 부모 데이터 갱신 시 로컬 수량 동기화
  useEffect(() => {
    setQuantities(Object.fromEntries(savedItems.map((i) => [i.productName, i.quantity])));
  }, [savedItems]);

  const sorted = useMemo(
    () => [...editList].sort((a, b) => a.productName.localeCompare(b.productName, "ko")),
    [editList]
  );

  const handleBlur = useCallback(
    (name: string, value: number) => {
      const prev = savedItems.find((i) => i.productName === name)?.quantity ?? 0;
      if (value !== prev) {
        onSave({ ...quantities, [name]: value });
      }
    },
    [savedItems, quantities, onSave]
  );

  const summaryItems = showSummaryList ? savedItems.filter((i) => i.quantity > 0) : [];

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {sorted.length > 0 ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-between w-full text-left mb-1.5"
        >
          <span className="text-xs text-gray-400">
            {label} <span className="text-blue-400">(수기)</span>
          </span>
          <svg
            className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <p className="text-xs text-gray-400 mb-1.5">{label}</p>
      )}

      {/* 저장된 아이템 요약 (협찬용 — showSummaryList=true 시만 표시) */}
      {summaryItems.length > 0 && (
        <ul className="mt-1 mb-2 space-y-0.5">
          {summaryItems.map((item) => (
            <li
              key={item.productName}
              className="text-sm text-gray-600 rounded-md cursor-default"
              style={{ padding: "4px 6px", margin: "0 -6px" }}
            >
              {item.productName}{" "}
              <span className="font-semibold text-gray-800">{item.quantity}개</span>
            </li>
          ))}
        </ul>
      )}

      {/* 합계 라인 */}
      <p className="text-sm text-gray-700">
        {summaryPrefix} {totalQuantity}개 · 끈갈피 {handmadeQuantity}개
      </p>

      {/* 수기 입력 목록 (토글) */}
      {open && sorted.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {sorted.map((row) => (
            <InputRow
              key={row.productName}
              label={row.productName}
              value={quantities[row.productName] ?? 0}
              onChange={(v) =>
                setQuantities((prev) => ({ ...prev, [row.productName]: v }))
              }
              onBlur={(v) => handleBlur(row.productName, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
