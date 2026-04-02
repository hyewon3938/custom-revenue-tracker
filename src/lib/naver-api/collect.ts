import {
  NaverData,
  PlatformFees,
  ProductSales,
  ScrapeWarning,
} from "@/lib/types";
import { detectCategory } from "@/lib/calculations/product";
import {
  calcPlatformProfit,
  calcNaverShippingStats,
  naverMaterialBase,
} from "@/lib/calculations/profit";
import { getOrders, filterValidOrders } from "./orders";
import { getSettlements } from "./settlement";

/**
 * 네이버 커머스 API로 월간 데이터 수집.
 * 기존 Playwright 스크레이퍼 3개(sales, orders, settlement)를 대체.
 *
 * 1. Orders API → 매출, 결제자수, 배송비, 제품별 판매수량
 * 2. Settlement API → 정산금, 수수료
 */
export async function collectNaverDataViaApi(
  startDate: string,
  endDate: string
): Promise<{ data: NaverData; warnings: ScrapeWarning[] }> {
  const warnings: ScrapeWarning[] = [];

  // ─── 1. 주문 데이터 ────────────────────────────────────────────────
  let allOrders = await getOrders(startDate, endDate);
  const validOrders = filterValidOrders(allOrders);

  // 매출: 유효 주문의 totalPaymentAmount 합산
  const revenue = validOrders.reduce(
    (sum, o) => sum + o.totalPaymentAmount, 0
  );

  // 배송비: 주문(orderId) 단위로 중복 제거 후 합산
  // (한 주문에 상품 여러 개면 deliveryFeeAmount가 중복될 수 있음)
  const orderShippingMap = new Map<string, number>();
  for (const order of validOrders) {
    const current = orderShippingMap.get(order.orderId) ?? 0;
    orderShippingMap.set(order.orderId, Math.max(current, order.deliveryFeeAmount));
  }
  const shippingCollected = Array.from(orderShippingMap.values())
    .reduce((sum, fee) => sum + fee, 0);
  const payerCount = orderShippingMap.size;

  // 제품별 판매수량 집계
  const productMap = new Map<string, ProductSales>();
  for (const order of validOrders) {
    const key = resolveProductKey(order.productName, order.productOption);
    const existing = productMap.get(key);
    if (existing) {
      existing.quantity += order.quantity;
    } else {
      productMap.set(key, {
        productName: key,
        category: detectCategory(key),
        platform: "naver",
        quantity: order.quantity,
      });
    }
  }
  const products = Array.from(productMap.values());

  const handmadeQuantity = products
    .filter((p) => p.category === "handmade")
    .reduce((s, p) => s + p.quantity, 0);
  const totalQuantity = products.reduce((s, p) => s + p.quantity, 0);

  // ─── 2. 정산 데이터 ────────────────────────────────────────────────
  let settlementAmount = 0;
  let commissionFee = 0;

  try {
    const settlements = await getSettlements(startDate, endDate);
    settlementAmount = settlements.reduce(
      (sum, s) => sum + s.settleAmount, 0
    );
    // commissionSettleAmount는 음수일 수 있으므로 절대값 사용
    commissionFee = Math.abs(
      settlements.reduce((sum, s) => sum + s.commissionSettleAmount, 0)
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    warnings.push({
      level: "error",
      message: `네이버 정산 API 호출 실패: ${msg}`,
    });
  }

  // ─── 3. 계산 ──────────────────────────────────────────────────────
  const shippingStats = calcNaverShippingStats(shippingCollected, payerCount);
  const fees: PlatformFees = {
    commissionFee,
    logisticsFee: shippingStats.sellerCost,
    adFee: 0,
    settlementAmount,
  };

  return {
    data: {
      revenue,
      shippingCollected,
      payerCount,
      totalQuantity,
      handmadeQuantity,
      otherQuantity: totalQuantity - handmadeQuantity,
      fees,
      shippingStats,
      profit: calcPlatformProfit(
        revenue, fees, naverMaterialBase(revenue, shippingCollected)
      ),
      products,
    },
    warnings,
  };
}

// ─── 옵션별 분리 ────────────────────────────────────────────────────────

/** 비즈 식물 상품은 옵션별로 분리 집계, 나머지는 상품명 그대로 */
function resolveProductKey(
  productName: string,
  productOption?: string
): string {
  if (!productOption) return productName;
  if (productName.includes("비즈 식물") || productName.includes("비즈식물")) {
    const option = productOption.trim();
    return option ? `${productName} - ${option}` : productName;
  }
  return productName;
}
