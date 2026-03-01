/**
 * 여러 모듈에서 재사용하는 기본값 상수.
 * 비즈니스 설정(환경변수 기반)은 config.ts에, 구조적 기본값은 여기에 정의.
 */
import type { PlatformFees, SponsorshipData } from "@/lib/types";

/** 비용 항목이 모두 0인 기본 PlatformFees */
export const EMPTY_FEES: PlatformFees = {
  settlementAmount: 0,
  logisticsFee: 0,
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
