import { naverApi } from "./client";
import type { OrderListResponse, OrderApiItem, NaverProductOrder } from "./types";

/** 취소/반품 상태 (이 상태의 주문은 매출 집계에서 제외) */
const CANCELLED_STATUSES = new Set([
  "CANCELED",
  "RETURNED",
  "CANCEL_REQUEST",
  "RETURN_REQUEST",
]);

/**
 * 날짜 범위 주문 조회
 * - 커머스 API 제한: 1회 요청당 최대 24시간 범위
 * - 180일 이내 주문만 조회 가능
 * - 긴 범위는 내부에서 1일 단위로 분할하여 조회
 */
export async function getOrders(
  startDate: string,
  endDate: string
): Promise<NaverProductOrder[]> {
  const allOrders: NaverProductOrder[] = [];
  const chunks = splitDateRange(startDate, endDate);

  for (const { from, to } of chunks) {
    const response = await naverApi<OrderListResponse>(
      "/pay-order/seller/product-orders",
      {
        params: {
          from: `${from}T00:00:00.000+09:00`,
          to: `${to}T23:59:59.999+09:00`,
          rangeType: "PAYED_DATETIME",
        },
      }
    );
    allOrders.push(...response.data.contents.map(flattenOrder));
  }

  return allOrders;
}

/** 유효 주문만 필터 (취소/반품 제외) */
export function filterValidOrders(
  orders: NaverProductOrder[]
): NaverProductOrder[] {
  return orders.filter((o) => {
    if (o.claimType === "CANCEL" || o.claimType === "RETURN") return false;
    if (CANCELLED_STATUSES.has(o.productOrderStatus)) return false;
    return true;
  });
}

/** API 중첩 응답을 플랫 구조로 변환 */
function flattenOrder(item: OrderApiItem): NaverProductOrder {
  const { order, productOrder } = item.content;
  return {
    productOrderId: productOrder.productOrderId,
    orderId: order.orderId,
    orderDate: order.orderDate,
    productId: productOrder.productId,
    productName: productOrder.productName,
    quantity: productOrder.quantity,
    unitPrice: productOrder.unitPrice,
    totalPaymentAmount: productOrder.totalPaymentAmount,
    productOrderStatus: productOrder.productOrderStatus,
    paymentDate: order.paymentDate,
    deliveryFeeAmount: productOrder.deliveryFeeAmount,
    productDiscountAmount: productOrder.productDiscountAmount,
    expectedSettlementAmount: productOrder.expectedSettlementAmount,
    claimType: productOrder.claimType,
    claimStatus: productOrder.claimStatus,
    productOption: productOrder.productOption,
  };
}

/**
 * 날짜 범위를 1일 단위 청크로 분할
 * - 커머스 API의 24시간 제한 대응
 */
export function splitDateRange(
  start: string,
  end: string
): Array<{ from: string; to: string }> {
  const chunks: Array<{ from: string; to: string }> = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    chunks.push({ from: dateStr, to: dateStr });
    current.setDate(current.getDate() + 1);
  }

  return chunks;
}
