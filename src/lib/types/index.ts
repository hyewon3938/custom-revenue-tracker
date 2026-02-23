export type Platform = "naver" | "coupang" | "offline";
export type ProductCategory = "handmade" | "other"; // handmade = 끈갈피

/** 개별 제품 판매 데이터 */
export interface ProductSales {
  productId: string;
  productName: string;
  category: ProductCategory; // handmade = 끈갈피
  platform: Platform;
  quantity: number; // 판매 수량
  revenue: number; // 매출액 (원)
}

/** 플랫폼별 비용 내역 */
export interface PlatformFees {
  settlementAmount: number; // 정산금 (실제 입금 예정액)
  logisticsFee: number; // 물류비
  commissionFee: number; // 플랫폼 수수료
  shippingFee: number; // 배송비
  adFee: number; // 광고비
}

/** 플랫폼별 데이터 */
export interface PlatformData {
  platform: Platform;
  revenue: number; // 총 매출
  fees: PlatformFees;
  products: ProductSales[]; // 제품별 판매 내역
}

/** 오프라인 매출 (수기 입력) */
export interface OfflineData {
  revenue: number;
  products: ProductSales[];
  fees: {
    logisticsFee: number;
    shippingFee: number;
  };
}

/** 수익성 계산 결과 */
export interface ProfitSummary {
  totalRevenue: number; // 최종 매출 (네이버 + 쿠팡 + 오프라인)
  materialCost: number; // 재료비 (매출의 15%)
  platformFees: number; // 플랫폼 총 비용 합계 (수수료+물류비+배송비+광고비)
  grossProfit: number; // 최종 이익 = 매출 - 플랫폼비용
  netProfit: number; // 순이익 = 최종이익 - 재료비
}

/** 끈갈피 상품 판매 랭킹 엔트리 */
export interface HandmadeRankEntry {
  rank: number;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  byPlatform: {
    platform: Platform;
    quantity: number;
    revenue: number;
  }[];
}

/** Claude AI 인사이트 */
export interface SalesInsight {
  title: string;
  description: string;
  type: "positive" | "negative" | "neutral" | "action";
}

/** 월별 종합 레포트 (저장/편집 단위) */
export interface MonthlyReport {
  period: { year: number; month: number };
  naver: PlatformData;
  coupang: PlatformData;
  offline: OfflineData;
  profit: ProfitSummary;
  handmadeRanking: HandmadeRankEntry[]; // 끈갈피 TOP 5
  insights: SalesInsight[];
  collectedAt: string; // 자동 수집 시각 (ISO 8601)
  lastModifiedAt: string; // 마지막 수정 시각 (ISO 8601)
}
