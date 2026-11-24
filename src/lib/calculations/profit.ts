import {
  NaverData,
  CoupangData,
  OfflineData,
  PlatformFees,
  PlatformProfit,
  ShippingStats,
  OverallSummary,
} from "@/lib/types";
import {
  ONLINE_MATERIAL_RATE,
  OFFLINE_MATERIAL_RATE,
  NAVER_SHIPPING_FEE,
  NAVER_SHIPPING_COST,
  COUPANG_SHIPPING_MARKUP,
} from "@/lib/config";
import { GOSAN_VENUE_ID } from "@/lib/constants";

// ─── 플랫폼 공통 이익 계산 ──────────────────────────────────────────────────

/**
 * 통합 이익 계산 함수.
 * 호출자가 플랫폼별 비즈니스 규칙에 따라 materialBase를 계산하여 전달.
 *
 * @param revenue      매출 (결제금액)
 * @param fees         플랫폼 비용 내역
 * @param materialBase 부자재비 계산 기준 금액 (플랫폼별 다름)
 * @param materialRate 부자재비 비율 (기본: ONLINE_MATERIAL_RATE)
 */
export function calcPlatformProfit(
  revenue: number,
  fees: PlatformFees,
  materialBase: number,
  materialRate: number = ONLINE_MATERIAL_RATE,
): PlatformProfit {
  const profit =
    revenue -
    fees.commissionFee -
    fees.logisticsFee -
    fees.inboundShippingFee -
    fees.adFee;
  const materialCost = Math.round(materialBase * materialRate);
  const netProfit = profit - materialCost;
  return { profit, materialCost, netProfit };
}

// ─── 네이버 배송 통계 계산 ──────────────────────────────────────────────────

/**
 * 고객 배송비 합계와 결제자수로 배송 건수 및 판매자 실배송비 계산.
 * - regularCount = shippingCollected / NAVER_SHIPPING_FEE
 * - freeCount = payerCount - regularCount
 * - sellerCost = freeCount × COST + regularCount × (COST - FEE)
 */
export function calcNaverShippingStats(
  shippingCollected: number,
  payerCount: number,
): ShippingStats {
  const regularCount =
    NAVER_SHIPPING_FEE > 0
      ? Math.round(shippingCollected / NAVER_SHIPPING_FEE)
      : 0;
  const freeCount = Math.max(0, payerCount - regularCount);
  const sellerCost =
    freeCount * NAVER_SHIPPING_COST +
    regularCount * (NAVER_SHIPPING_COST - NAVER_SHIPPING_FEE);

  return { regularCount, freeCount, sellerCost };
}

// ─── materialBase 헬퍼 ──────────────────────────────────────────────────────

/** 네이버: 순수 상품 매출 (고객 배송비 제외) */
export function naverMaterialBase(
  revenue: number,
  shippingCollected: number,
): number {
  return revenue - shippingCollected;
}

/** 쿠팡: 배송 마크업 제외한 정가 기준 매출 */
export function coupangMaterialBase(
  revenue: number,
  totalQuantity: number,
): number {
  return revenue - totalQuantity * COUPANG_SHIPPING_MARKUP;
}

/** 고산의낮: 매출(할인가) + 할인분(수수료) = 정가 기준 */
export function gosanMaterialBase(
  revenue: number,
  commissionFee: number,
): number {
  return revenue + commissionFee;
}

/** 입점처별 materialBase 결정 + 이익 계산 (gosan 분기 로직을 한 곳에서 관리) */
export function calcOfflineVenueProfit(venue: OfflineData): OfflineData {
  const matBase =
    venue.venueId === GOSAN_VENUE_ID
      ? gosanMaterialBase(venue.revenue, venue.fees.commissionFee)
      : venue.revenue;
  return {
    ...venue,
    profit: calcPlatformProfit(
      venue.revenue,
      venue.fees,
      matBase,
      OFFLINE_MATERIAL_RATE,
    ),
  };
}

// ─── 전체 요약 계산 ────────────────────────────────────────────────────────

export function calcOverallSummary(
  naver: NaverData,
  coupang: CoupangData,
  offlineVenues: OfflineData[],
  marketingCost: number = 0,
): OverallSummary {
  const sumOffline = (pick: (venue: OfflineData) => number): number =>
    offlineVenues.reduce((sum, venue) => sum + pick(venue), 0);

  const offRevenue = sumOffline((v) => v.revenue);
  const offCommission = sumOffline((v) => v.fees.commissionFee);
  const offLogistics = sumOffline((v) => v.fees.logisticsFee);
  const offInbound = sumOffline((v) => v.fees.inboundShippingFee);
  const offAd = sumOffline((v) => v.fees.adFee);
  const offProfit = sumOffline((v) => v.profit.profit);
  const offMaterial = sumOffline((v) => v.profit.materialCost);
  const offNetProfit = sumOffline((v) => v.profit.netProfit);
  const offTotal = sumOffline((v) => v.totalQuantity);
  const offHandmade = sumOffline((v) => v.handmadeQuantity);
  const offOther = sumOffline((v) => v.otherQuantity);

  return {
    totalRevenue: naver.revenue + coupang.revenue + offRevenue,
    totalCommissionFee:
      naver.fees.commissionFee + coupang.fees.commissionFee + offCommission,
    totalLogisticsFee:
      naver.fees.logisticsFee + coupang.fees.logisticsFee + offLogistics,
    totalInboundShippingFee:
      naver.fees.inboundShippingFee +
      coupang.fees.inboundShippingFee +
      offInbound,
    totalAdFee: naver.fees.adFee + coupang.fees.adFee + offAd,
    totalProfit: naver.profit.profit + coupang.profit.profit + offProfit,
    totalMaterialCost:
      naver.profit.materialCost + coupang.profit.materialCost + offMaterial,
    marketingCost,
    totalNetProfit:
      naver.profit.netProfit +
      coupang.profit.netProfit +
      offNetProfit -
      marketingCost,
    totalQuantity: naver.totalQuantity + coupang.totalQuantity + offTotal,
    handmadeQuantity:
      naver.handmadeQuantity + coupang.handmadeQuantity + offHandmade,
    otherQuantity: naver.otherQuantity + coupang.otherQuantity + offOther,
  };
}
