import {
  NaverData,
  CoupangData,
  OfflineData,
  PlatformFees,
  PlatformProfit,
  OverallSummary,
  ProductRankEntry,
  ProductMatrixRow,
  ProductSales,
  Platform,
  ProductCategory,
  ProductMappingConfig,
} from "@/lib/types";

// ─── 상수 ─────────────────────────────────────────────────────────────────
/** 온라인 부자재비율: (매출 - 물류비) × 15% */
export const ONLINE_MATERIAL_RATE = 0.15;
/** 오프라인 부자재비율: 매출 × 20% */
export const OFFLINE_MATERIAL_RATE = 0.2;
/** 네이버 기본 배송비 단가 */
export const NAVER_SHIPPING_UNIT = 3_000;

// ─── 플랫폼별 이익 계산 ────────────────────────────────────────────────────

/**
 * 온라인 플랫폼 이익 계산 (네이버 / 쿠팡)
 * - 이익 = 매출 - 수수료 - 물류비 - 광고비
 * - 부자재비 = (매출 - 물류비) × 15%
 * - 순이익 = 이익 - 부자재비
 */
export function calcOnlineProfit(
  revenue: number,
  fees: PlatformFees
): PlatformProfit {
  const profit =
    revenue - fees.commissionFee - fees.logisticsFee - fees.adFee;
  const materialCost = Math.round(
    (revenue - fees.logisticsFee) * ONLINE_MATERIAL_RATE
  );
  const netProfit = profit - materialCost;
  return { profit, materialCost, netProfit };
}

/**
 * 오프라인 플랫폼 이익 계산 (고산의낮)
 * - 이익 = 매출 - 수수료 - 물류비 - 광고비
 * - 부자재비 = 매출 × 20%
 * - 순이익 = 이익 - 부자재비
 */
export function calcOfflineProfit(
  revenue: number,
  fees: PlatformFees
): PlatformProfit {
  const profit =
    revenue - fees.commissionFee - fees.logisticsFee - fees.adFee;
  const materialCost = Math.round(revenue * OFFLINE_MATERIAL_RATE);
  const netProfit = profit - materialCost;
  return { profit, materialCost, netProfit };
}

// ─── 전체 요약 계산 ────────────────────────────────────────────────────────

export function calcOverallSummary(
  naver: NaverData,
  coupang: CoupangData,
  offline: OfflineData
): OverallSummary {
  return {
    totalRevenue: naver.revenue + coupang.revenue + offline.revenue,
    totalCommissionFee:
      naver.fees.commissionFee +
      coupang.fees.commissionFee +
      offline.fees.commissionFee,
    totalLogisticsFee:
      naver.fees.logisticsFee +
      coupang.fees.logisticsFee +
      offline.fees.logisticsFee,
    totalAdFee:
      naver.fees.adFee + coupang.fees.adFee + offline.fees.adFee,
    totalProfit:
      naver.profit.profit +
      coupang.profit.profit +
      offline.profit.profit,
    totalMaterialCost:
      naver.profit.materialCost +
      coupang.profit.materialCost +
      offline.profit.materialCost,
    totalNetProfit:
      naver.profit.netProfit +
      coupang.profit.netProfit +
      offline.profit.netProfit,
    totalQuantity:
      naver.totalQuantity + coupang.totalQuantity + offline.totalQuantity,
    handmadeQuantity:
      naver.handmadeQuantity +
      coupang.handmadeQuantity +
      offline.handmadeQuantity,
    otherQuantity:
      naver.otherQuantity + coupang.otherQuantity + offline.otherQuantity,
  };
}

// ─── 랭킹 계산 ────────────────────────────────────────────────────────────

/** 단일 플랫폼 상품 목록에서 TOP N 랭킹 생성 */
export function calcPlatformRanking(
  products: ProductSales[],
  topN: number
): ProductRankEntry[] {
  const platform = products[0]?.platform;
  const map = new Map<string, number>();

  for (const p of products) {
    map.set(p.productName, (map.get(p.productName) ?? 0) + p.quantity);
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, qty], idx) => {
      const category =
        products.find((p) => p.productName === name)?.category ?? "other";
      return {
        rank: idx + 1,
        productName: name,
        category,
        total: qty,
        naver: platform === "naver" ? qty : 0,
        coupang: platform === "coupang" ? qty : 0,
        offline: platform === "offline" ? qty : 0,
      };
    });
}

/**
 * 전체 통합 TOP N 랭킹 계산
 * 상품 매핑이 있으면 canonical명 기준으로 합산, 없으면 상품명 그대로 사용
 */
export function calcOverallRanking(
  naver: ProductSales[],
  coupang: ProductSales[],
  offline: ProductSales[],
  mapping: ProductMappingConfig | null,
  topN: number
): ProductRankEntry[] {
  // canonical명 결정 함수
  const toCanonical = (name: string, platform: Platform): string => {
    if (!mapping) return name;
    const m = mapping.mappings.find((m) =>
      platform === "naver"
        ? m.naver === name
        : platform === "coupang"
        ? m.coupang === name
        : m.canonical === name
    );
    return m?.canonical ?? name;
  };

  const map = new Map<
    string,
    { category: ProductCategory; naver: number; coupang: number; offline: number }
  >();

  const add = (products: ProductSales[], platform: Platform) => {
    for (const p of products) {
      const key = toCanonical(p.productName, platform);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { category: p.category, naver: 0, coupang: 0, offline: 0 });
      }
      const entry = map.get(key)!;
      entry[platform] += p.quantity;
    }
  };

  add(naver, "naver");
  add(coupang, "coupang");
  add(offline, "offline");

  return Array.from(map.entries())
    .map(([name, v]) => ({
      rank: 0,
      productName: name,
      category: v.category,
      total: v.naver + v.coupang + v.offline,
      naver: v.naver,
      coupang: v.coupang,
      offline: v.offline,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

// ─── 상품 × 플랫폼 매트릭스 ───────────────────────────────────────────────

export function calcProductMatrix(
  naver: ProductSales[],
  coupang: ProductSales[],
  offline: ProductSales[],
  mapping: ProductMappingConfig | null
): ProductMatrixRow[] {
  const toCanonical = (name: string, platform: Platform): string => {
    if (!mapping) return name;
    const m = mapping.mappings.find((m) =>
      platform === "naver"
        ? m.naver === name
        : platform === "coupang"
        ? m.coupang === name
        : m.canonical === name
    );
    return m?.canonical ?? name;
  };

  const map = new Map<
    string,
    { category: ProductCategory; naver: number; coupang: number; offline: number }
  >();

  const add = (products: ProductSales[], platform: Platform) => {
    for (const p of products) {
      const key = toCanonical(p.productName, platform);
      if (!map.has(key)) {
        map.set(key, { category: p.category, naver: 0, coupang: 0, offline: 0 });
      }
      map.get(key)![platform] += p.quantity;
    }
  };

  add(naver, "naver");
  add(coupang, "coupang");
  add(offline, "offline");

  return Array.from(map.entries())
    .map(([name, v]) => ({
      productName: name,
      category: v.category,
      naver: v.naver,
      coupang: v.coupang,
      offline: v.offline,
      total: v.naver + v.coupang + v.offline,
    }))
    .sort((a, b) => b.total - a.total);
}

