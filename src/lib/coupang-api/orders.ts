import { coupangApi } from "./client";
import type { RgOrderListResponse, RgOrder } from "./types";

/**
 * 로켓그로스 주문 목록 조회
 * - GET /v2/providers/rg_open_api/apis/api/v1/vendors/{vendorId}/rg/orders
 * - 날짜 형식: yyyymmdd
 * - 최대 30일 범위
 * - nextToken으로 페이지네이션
 */
export async function getRgOrders(
  vendorId: string,
  startDate: string,
  endDate: string
): Promise<RgOrder[]> {
  // yyyy-MM-dd → yyyymmdd 변환
  const from = startDate.replace(/-/g, "");
  const to = endDate.replace(/-/g, "");

  const allOrders: RgOrder[] = [];
  let nextToken: string | undefined;

  do {
    const params: Record<string, string> = {
      paidDateFrom: from,
      paidDateTo: to,
    };
    if (nextToken) params.nextToken = nextToken;

    const response = await coupangApi<RgOrderListResponse>(
      `/v2/providers/rg_open_api/apis/api/v1/vendors/${vendorId}/rg/orders`,
      { params }
    );

    if (response.data && response.data.length > 0) {
      allOrders.push(...response.data);
    }

    nextToken = response.nextToken || undefined;
  } while (nextToken);

  return allOrders;
}
