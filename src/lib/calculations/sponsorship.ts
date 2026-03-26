import type { SponsoredItem } from "@/lib/types";
import {
  MARKETING_LINK_FEE_RATE,
  SPONSOR_SHIPPING_FEE,
  SPONSOR_SHIPPING_COST,
} from "@/lib/config";

/**
 * 협찬 제품 1개당 순 광고비 계산.
 *
 * 공식: (단가 + 고객배송비) × (VAT 10% + 수수료율) + 실배송비
 *
 * 구성요소:
 * - (단가 + 고객배송비) × 0.1   → 업체 선지급 부가세
 * - (단가 + 고객배송비) × 수수료 → 네이버가 가져가는 수수료
 * - 실배송비(3,300)              → 고객배송비(3,000)와의 차액 + 배송비 부가세
 *
 * ※ 재료비는 플랫폼 매출 계산에서 이미 차감되므로 여기에 포함하지 않음
 */
export function calcUnitSponsorshipCost(unitPrice: number): number {
  return Math.round(
    (unitPrice + SPONSOR_SHIPPING_FEE) * (0.1 + MARKETING_LINK_FEE_RATE) +
      SPONSOR_SHIPPING_COST
  );
}

/**
 * 협찬 아이템 목록 전체의 총 마케팅 비용 산출.
 * unitPrice가 없거나 0인 아이템이 하나라도 있으면 null 반환
 * → 호출자가 기존 수기 입력값을 유지할지 결정.
 */
export function calcTotalSponsorshipCost(
  items: SponsoredItem[]
): number | null {
  if (items.length === 0) return 0;
  if (items.some((i) => i.unitPrice == null || i.unitPrice <= 0)) return null;
  return items.reduce(
    (sum, item) => sum + calcUnitSponsorshipCost(item.unitPrice!) * item.quantity,
    0
  );
}
