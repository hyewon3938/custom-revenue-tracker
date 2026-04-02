import { naverApi } from "./client";
import type { SettlementResponse, NaverSettlement } from "./types";

/**
 * 일별 정산 내역 조회
 * - GET /v1/pay-settle/settle/daily
 */
export async function getSettlements(
  startDate: string,
  endDate: string
): Promise<NaverSettlement[]> {
  const response = await naverApi<SettlementResponse>(
    "/pay-settle/settle/daily",
    { params: { startDate, endDate } }
  );

  return response.elements;
}
