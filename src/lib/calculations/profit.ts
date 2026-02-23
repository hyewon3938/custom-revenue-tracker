import {
  PlatformData,
  OfflineData,
  PlatformFees,
  ProfitSummary,
  HandmadeRankEntry,
  Platform,
} from "@/lib/types";

/** 재료비율: 판매가의 15% */
export const MATERIAL_COST_RATE = 0.15;

/** 플랫폼 수수료 항목 합계 (정산금 제외, 실제 비용만) */
export function sumFees(fees: PlatformFees): number {
  return (
    fees.logisticsFee + fees.commissionFee + fees.shippingFee + fees.adFee
  );
}

/**
 * 최종 매출·이익·순이익 계산
 *
 * - 최종 매출 = 네이버 + 쿠팡 + 오프라인 매출
 * - 재료비    = 최종 매출 × 15%
 * - 플랫폼비용 = 네이버(물류+수수료+배송+광고) + 쿠팡(물류+수수료+배송+광고) + 오프라인(물류+배송)
 * - 최종 이익 = 최종 매출 - 플랫폼비용
 * - 순이익    = 최종 이익 - 재료비
 */
export function calculateProfit(
  naver: PlatformData,
  coupang: PlatformData,
  offline: OfflineData
): ProfitSummary {
  const totalRevenue = naver.revenue + coupang.revenue + offline.revenue;
  const materialCost = Math.round(totalRevenue * MATERIAL_COST_RATE);

  const platformFees =
    sumFees(naver.fees) +
    sumFees(coupang.fees) +
    offline.fees.logisticsFee +
    offline.fees.shippingFee;

  const grossProfit = totalRevenue - platformFees;
  const netProfit = grossProfit - materialCost;

  return { totalRevenue, materialCost, platformFees, grossProfit, netProfit };
}

/**
 * 끈갈피(handmade) 상품 판매량 TOP 5 랭킹 계산
 *
 * 동일 상품명을 기준으로 네이버·쿠팡·오프라인 판매량을 합산해 정렬.
 * 상품명이 완전히 같아야 동일 상품으로 인식 (대소문자 구분 없음).
 */
export function calculateHandmadeRanking(
  naver: PlatformData,
  coupang: PlatformData,
  offline: OfflineData
): HandmadeRankEntry[] {
  const allHandmade = [
    ...naver.products.filter((p) => p.category === "handmade"),
    ...coupang.products.filter((p) => p.category === "handmade"),
    ...offline.products.filter((p) => p.category === "handmade"),
  ];

  // 상품명(소문자) 기준으로 플랫폼별 집계
  const productMap = new Map<
    string,
    {
      productName: string;
      totalQuantity: number;
      totalRevenue: number;
      byPlatform: Map<Platform, { quantity: number; revenue: number }>;
    }
  >();

  for (const product of allHandmade) {
    const key = product.productName.toLowerCase().trim();

    if (!productMap.has(key)) {
      productMap.set(key, {
        productName: product.productName,
        totalQuantity: 0,
        totalRevenue: 0,
        byPlatform: new Map(),
      });
    }

    const entry = productMap.get(key)!;
    entry.totalQuantity += product.quantity;
    entry.totalRevenue += product.revenue;

    const existing = entry.byPlatform.get(product.platform);
    if (existing) {
      existing.quantity += product.quantity;
      existing.revenue += product.revenue;
    } else {
      entry.byPlatform.set(product.platform, {
        quantity: product.quantity,
        revenue: product.revenue,
      });
    }
  }

  return Array.from(productMap.values())
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 5)
    .map((entry, idx) => ({
      rank: idx + 1,
      productName: entry.productName,
      totalQuantity: entry.totalQuantity,
      totalRevenue: entry.totalRevenue,
      byPlatform: Array.from(entry.byPlatform.entries()).map(
        ([platform, data]) => ({
          platform,
          quantity: data.quantity,
          revenue: data.revenue,
        })
      ),
    }));
}
