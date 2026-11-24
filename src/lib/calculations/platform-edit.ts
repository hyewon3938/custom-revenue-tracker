import type { Platform, ProductMatrixRow, ProductSales } from "@/lib/types";

/** 쿠팡 데이터 제공 시작 연월. 그 이전 월은 판매량 수기 입력 모드. */
export const COUPANG_DATA_START_YEAR = 2025;
export const COUPANG_DATA_START_MONTH = 3;

/** 수량 입력의 하한 */
const MIN_QTY = 0;

/** 쿠팡 데이터 제공 시작(2025년 3월) 이전 월인지 — 수기 입력 모드 여부 */
export function isCoupangManual(year: number, month: number): boolean {
  return (
    year < COUPANG_DATA_START_YEAR ||
    (year === COUPANG_DATA_START_YEAR && month < COUPANG_DATA_START_MONTH)
  );
}

/**
 * 쿠팡 수기 모드의 편집 대상 목록.
 * productMatrix 뒤에, 매트릭스에 없는 기존 쿠팡 상품을 저장 순서대로 덧붙인다.
 * 수기 모드가 아니면 빈 배열.
 */
export function buildCoupangEditList(
  isManual: boolean,
  productMatrix: ProductMatrixRow[],
  products: ProductSales[],
): ProductMatrixRow[] {
  if (!isManual) return [];
  const knownNames = new Set(productMatrix.map((r) => r.productName));
  const extras: ProductMatrixRow[] = products
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
}

/**
 * 수기 입력 수량 → 저장용 상품 목록.
 * 수량이 0보다 큰 행만 editList 순서대로 남긴다.
 */
export function toProductSales(
  editList: ProductMatrixRow[],
  quantities: Record<string, number>,
  platform: Platform,
): ProductSales[] {
  return editList
    .filter((row) => (quantities[row.productName] ?? 0) > 0)
    .map((row) => ({
      productName: row.productName,
      category: row.category,
      platform,
      quantity: quantities[row.productName],
    }));
}

/**
 * 숫자 입력란의 문자열 → 0 이상의 수 (수량·단가 입력 공용).
 * 빈 문자열은 0, 음수는 0, 소수는 그대로, 숫자가 아니면 NaN.
 */
export function parseQty(raw: string): number {
  return Math.max(MIN_QTY, Number(raw));
}
