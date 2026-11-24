/**
 * 여러 모듈에서 재사용하는 기본값 상수.
 * 비즈니스 설정(환경변수 기반)은 config.ts에, 구조적 기본값은 여기에 정의.
 */
import type { PlatformFees, SponsorshipData } from "@/lib/types";

/** 비용 항목이 모두 0인 기본 PlatformFees */
export const EMPTY_FEES: PlatformFees = {
  settlementAmount: 0,
  logisticsFee: 0,
  inboundShippingFee: 0,
  commissionFee: 0,
  adFee: 0,
};

/** 협찬 데이터 초기값 */
export const DEFAULT_SPONSORSHIP: SponsorshipData = {
  items: [],
  marketingCost: 0,
  totalQuantity: 0,
  handmadeQuantity: 0,
};

/** 기본 오프라인 입점처(고산의낮) ID — 부자재비 기준 금액 계산이 다른 입점처와 다름 */
export const GOSAN_VENUE_ID = "gosan";

/** 부가세 포함 배수 (공급가 × 1.1) */
export const VAT_MULTIPLIER = 1.1;

/** 플랫폼별(네이버·쿠팡·오프라인) 랭킹에 담는 상품 개수 */
export const PLATFORM_RANKING_SIZE = 3;

/** 전체 통합 랭킹과 협찬 제외 랭킹에 담는 상품 개수 */
export const OVERALL_RANKING_SIZE = 5;

/**
 * 수집 요청(POST /api/scrape) 클라이언트 타임아웃 (ms).
 * 수동 로그인 대기(최대 5분) + 스크레이핑 시간을 감안한 상한.
 * 서버가 끝내 응답하지 않아도 버튼이 "수집 중"에 갇히지 않도록 한다.
 */
export const COLLECT_TIMEOUT_MS = 15 * 60 * 1_000;
