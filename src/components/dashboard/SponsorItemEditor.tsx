"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { SponsoredItem, ProductMatrixRow } from "@/lib/types";

interface Props {
  savedItems: SponsoredItem[];
  editList: ProductMatrixRow[];
  totalQuantity: number;
  handmadeQuantity: number;
  onSave: (items: SponsoredItem[]) => Promise<void>;
}

export default function SponsorItemEditor({
  savedItems,
  editList,
  totalQuantity,
  handmadeQuantity,
  onSave,
}: Props) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Record<string, { quantity: number; unitPrice: number }>>(
    () => toFields(savedItems)
  );

  useEffect(() => {
    setFields(toFields(savedItems));
  }, [savedItems]);

  const sorted = useMemo(
    () => [...editList].sort((a, b) => a.productName.localeCompare(b.productName, "ko")),
    [editList]
  );

  const handleBlur = useCallback(
    (name: string, field: "quantity" | "unitPrice", value: number) => {
      const current = fields[name] ?? { quantity: 0, unitPrice: 0 };
      const updated = { ...current, [field]: value };
      const newFields = { ...fields, [name]: updated };

      // 변경 없으면 저장 생략
      const saved = savedItems.find((i) => i.productName === name);
      if (
        updated.quantity === (saved?.quantity ?? 0) &&
        updated.unitPrice === (saved?.unitPrice ?? 0)
      ) {
        return;
      }

      const items: SponsoredItem[] = editList
        .filter((row) => (newFields[row.productName]?.quantity ?? 0) > 0)
        .map((row) => ({
          productName: row.productName,
          category: row.category,
          quantity: newFields[row.productName]?.quantity ?? 0,
          unitPrice: newFields[row.productName]?.unitPrice || undefined,
        }));

      onSave(items);
    },
    [fields, savedItems, editList, onSave]
  );

  return (
    <div className="mt-3 pt-3 border-t border-warm-100">
      {sorted.length > 0 ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-between w-full text-left mb-1.5"
        >
          <span className="text-xs text-gray-400">
            협찬 상품 <span className="text-brand-400">(수기)</span>
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
        <p className="text-xs text-gray-400 mb-1.5">협찬 상품</p>
      )}

      <p className="text-sm text-gray-700">
        총 제공량 {totalQuantity}개 · 끈갈피 {handmadeQuantity}개
      </p>

      {open && sorted.length > 0 && (
        <div className="mt-2 space-y-0.5">
          <div className="flex items-center gap-2 px-2 mb-1">
            <span className="flex-1 text-xs text-gray-400">상품</span>
            <span className="w-14 text-right text-xs text-gray-400">수량</span>
            <span className="w-24 text-right text-xs text-gray-400">단가(원)</span>
          </div>
          {sorted.map((row) => {
            const f = fields[row.productName] ?? { quantity: 0, unitPrice: 0 };
            return (
              <SponsorInputRow
                key={row.productName}
                label={row.productName}
                quantity={f.quantity}
                unitPrice={f.unitPrice}
                onChangeQuantity={(v) =>
                  setFields((prev) => ({
                    ...prev,
                    [row.productName]: {
                      ...(prev[row.productName] ?? { quantity: 0, unitPrice: 0 }),
                      quantity: v,
                    },
                  }))
                }
                onChangeUnitPrice={(v) =>
                  setFields((prev) => ({
                    ...prev,
                    [row.productName]: {
                      ...(prev[row.productName] ?? { quantity: 0, unitPrice: 0 }),
                      unitPrice: v,
                    },
                  }))
                }
                onBlurQuantity={(v) => handleBlur(row.productName, "quantity", v)}
                onBlurUnitPrice={(v) => handleBlur(row.productName, "unitPrice", v)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

function toFields(
  items: SponsoredItem[]
): Record<string, { quantity: number; unitPrice: number }> {
  return Object.fromEntries(
    items.map((i) => [i.productName, { quantity: i.quantity, unitPrice: i.unitPrice ?? 0 }])
  );
}

// ─── 개별 입력 행 ───────────────────────────────────────────────────────────

function SponsorInputRow({
  label,
  quantity,
  unitPrice,
  onChangeQuantity,
  onChangeUnitPrice,
  onBlurQuantity,
  onBlurUnitPrice,
}: {
  label: string;
  quantity: number;
  unitPrice: number;
  onChangeQuantity: (v: number) => void;
  onChangeUnitPrice: (v: number) => void;
  onBlurQuantity: (v: number) => void;
  onBlurUnitPrice: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg transition-colors"
      style={{ backgroundColor: focused ? "var(--brand-50)" : undefined }}
      onMouseEnter={(e) => {
        if (!focused) e.currentTarget.style.backgroundColor = "var(--warm-100)";
      }}
      onMouseLeave={(e) => {
        if (!focused) e.currentTarget.style.backgroundColor = "";
      }}
    >
      <span
        className="text-xs truncate flex-1 transition-colors"
        style={{ color: focused ? "var(--brand-500)" : "#4b5563" }}
        title={label}
      >
        {label}
      </span>
      <input
        type="number"
        min="0"
        value={quantity}
        onChange={(e) => onChangeQuantity(Math.max(0, Number(e.target.value)))}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          onBlurQuantity(Math.max(0, Number(e.target.value)));
        }}
        className="w-14 shrink-0 text-right text-xs border rounded px-2 py-1 focus:outline-none transition-colors"
        style={{ borderColor: focused ? "var(--brand-400)" : "var(--warm-200)" }}
      />
      <input
        type="number"
        min="0"
        step="100"
        value={unitPrice || ""}
        placeholder="단가"
        onChange={(e) => onChangeUnitPrice(Math.max(0, Number(e.target.value)))}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          setFocused(false);
          onBlurUnitPrice(Math.max(0, Number(e.target.value)));
        }}
        className="w-24 shrink-0 text-right text-xs border rounded px-2 py-1 focus:outline-none transition-colors"
        style={{ borderColor: focused ? "var(--brand-400)" : "var(--warm-200)" }}
      />
    </div>
  );
}
