import type { Platform, ProductSales } from "@/lib/types";
import { detectCategory } from "./product";

/** 집계 전 판매 1건 (주문 한 줄) */
export interface ProductQuantityEntry {
  productName: string;
  quantity: number;
}

/**
 * 같은 상품명끼리 수량을 합쳐 제품별 판매 목록을 만든다.
 * - 결과 순서는 각 상품명이 처음 나온 순서
 * - 카테고리는 상품명으로 판정
 */
export function aggregateProductSales(
  entries: ProductQuantityEntry[],
  platform: Platform,
): ProductSales[] {
  const productMap = new Map<string, ProductSales>();
  for (const { productName, quantity } of entries) {
    const existing = productMap.get(productName);
    if (existing) {
      existing.quantity += quantity;
    } else {
      productMap.set(productName, {
        productName,
        category: detectCategory(productName),
        platform,
        quantity,
      });
    }
  }
  return Array.from(productMap.values());
}

/**
 * 제품 목록의 수량 합계.
 * otherQuantity는 전체에서 handmade를 뺀 값이다.
 */
export function summarizeQuantities(products: ProductSales[]): {
  totalQuantity: number;
  handmadeQuantity: number;
  otherQuantity: number;
} {
  const handmadeQuantity = products
    .filter((p) => p.category === "handmade")
    .reduce((s, p) => s + p.quantity, 0);
  const totalQuantity = products.reduce((s, p) => s + p.quantity, 0);
  return {
    totalQuantity,
    handmadeQuantity,
    otherQuantity: totalQuantity - handmadeQuantity,
  };
}
