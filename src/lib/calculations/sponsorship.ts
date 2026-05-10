import type { SponsoredItem } from "@/lib/types";
import { SPONSOR_SHIPPING_FEE } from "@/lib/config";

/**
 * 협찬 제품 1개당 비용 계산.
 *
 * 공식: (단가 + 고객배송비) × 1.1
 *
 * 협찬은 사용자가 업체에 (단가 + 배송비) × 1.1을 미리 입금하고,
 * 리뷰어가 스토어에서 (단가 + 배송비)로 결제하여 그 금액이 매출로 잡히는 구조.
 * 매출에 부풀려져 들어간 사용자 자가 입금분을 순이익에서 환불 처리하기 위해
 * 협찬 비용으로 동일 금액을 차감한다.
 *
 * - (단가 + 배송비)       → 매출에 잡힌 협찬 분 환불
 * - (단가 + 배송비) × 0.1 → 업체에 미리 떼이는 부가세 (사용자 추가 부담)
 *
 * ※ 정산 수수료, 배송비 차액(300원), 부자재비는 정산서/자동 계산에서 차감되므로
 *   여기에 포함하지 않음 (이중 차감 방지)
 */
export function calcUnitSponsorshipCost(unitPrice: number): number {
  return Math.round((unitPrice + SPONSOR_SHIPPING_FEE) * 1.1);
}

/**
 * 협찬 아이템 목록 전체의 총 마케팅 비용 산출.
 * unitPrice가 없거나 0인 아이템이 하나라도 있으면 null 반환
 * → 호출자가 기존 수기 입력값을 유지할지 결정.
 */
export function calcTotalSponsorshipCost(
  items: SponsoredItem[],
): number | null {
  if (items.length === 0) return 0;
  if (items.some((i) => i.unitPrice == null || i.unitPrice <= 0)) return null;
  return items.reduce(
    (sum, item) =>
      sum + calcUnitSponsorshipCost(item.unitPrice!) * item.quantity,
    0,
  );
}
