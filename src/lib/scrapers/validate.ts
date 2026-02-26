import { NaverData, CoupangData, ScrapeWarning } from "@/lib/types";

/**
 * 수집 데이터 정합성 검증.
 * 스크레이퍼 개별 실패로 인한 불완전한 데이터 조합을 감지.
 *
 * @param failedScrapers 이미 재시도 실패로 경고가 생성된 스크레이퍼 이름 Set.
 *   해당 스크레이퍼 관련 검증 규칙은 건너뜀 (중복 경고 방지).
 */
export function validateCollectedData(
  naver: NaverData,
  coupang: CoupangData,
  failedScrapers: Set<string>
): ScrapeWarning[] {
  const warnings: ScrapeWarning[] = [];

  // ─── 네이버 ────────────────────────────────────────────────────────

  // 매출 있는데 상품 목록 비어있음
  if (
    naver.revenue > 0 &&
    naver.products.length === 0 &&
    !failedScrapers.has("naver-orders")
  ) {
    warnings.push({
      level: "error",
      message:
        "네이버 매출이 있지만 상품 목록을 가져오지 못했습니다. 주문 수집이 실패했을 수 있습니다.",
    });
  }

  // 상품 있는데 매출 0
  if (
    naver.products.length > 0 &&
    naver.revenue === 0 &&
    !failedScrapers.has("naver-sales")
  ) {
    warnings.push({
      level: "error",
      message:
        "네이버 상품 데이터는 있지만 매출이 0원입니다. 판매분석 수집이 실패했을 수 있습니다.",
    });
  }

  // 매출 있는데 정산/수수료 모두 0
  if (
    naver.revenue > 0 &&
    naver.fees.commissionFee === 0 &&
    naver.fees.settlementAmount === 0 &&
    !failedScrapers.has("naver-settlement")
  ) {
    warnings.push({
      level: "warn",
      message:
        "네이버 매출이 있지만 정산/수수료 데이터가 0원입니다. 정산내역 수집이 실패했을 수 있습니다.",
    });
  }

  // ─── 쿠팡 ─────────────────────────────────────────────────────────

  // 매출 있는데 상품 비어있음
  if (
    coupang.revenue > 0 &&
    coupang.products.length === 0 &&
    !failedScrapers.has("coupang-sales")
  ) {
    warnings.push({
      level: "error",
      message:
        "쿠팡 매출이 있지만 상품 목록을 가져오지 못했습니다. 판매분석 수집이 실패했을 수 있습니다.",
    });
  }

  // 상품 있는데 매출 0
  if (
    coupang.products.length > 0 &&
    coupang.revenue === 0 &&
    !failedScrapers.has("coupang-settlement")
  ) {
    warnings.push({
      level: "error",
      message:
        "쿠팡 상품 데이터는 있지만 매출이 0원입니다. 정산 수집이 실패했을 수 있습니다.",
    });
  }

  // 매출 있는데 비용 전부 0
  if (
    coupang.revenue > 0 &&
    coupang.fees.commissionFee === 0 &&
    coupang.fees.logisticsFee === 0 &&
    coupang.fees.adFee === 0 &&
    !failedScrapers.has("coupang-settlement")
  ) {
    warnings.push({
      level: "warn",
      message:
        "쿠팡 매출이 있지만 수수료/물류비/광고비가 모두 0원입니다. 정산 비용 파싱이 실패했을 수 있습니다.",
    });
  }

  // ─── 전체 ─────────────────────────────────────────────────────────

  // 양쪽 모두 매출 0
  if (naver.revenue === 0 && coupang.revenue === 0) {
    warnings.push({
      level: "warn",
      message:
        "네이버와 쿠팡 모두 매출이 0원입니다. 두 플랫폼 수집이 모두 실패했을 가능성이 있습니다.",
    });
  }

  return warnings;
}
