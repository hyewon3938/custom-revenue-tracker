export type Platform = "naver" | "coupang" | "offline";
export type ProductCategory = "handmade" | "other"; // handmade = 끈갈피/북마크/책갈피

// ─── 배송 건수 (네이버 전용) ───────────────────────────────────────────────
export interface ShippingStats {
  regularCount: number; // 일반배송 건수 (고객이 3,000원 부담)
  freeCount: number; // 무료배송 건수 (판매자가 3,000원 부담)
  sellerCost: number; // 판매자 배송비 지출 = freeCount × 3,000
}

// ─── 상품별 판매 데이터 ────────────────────────────────────────────────────
export interface ProductSales {
  productName: string;
  category: ProductCategory;
  platform: Platform;
  quantity: number;
}

// ─── 플랫폼별 비용 내역 ────────────────────────────────────────────────────
export interface PlatformFees {
  commissionFee: number; // 플랫폼 수수료
  logisticsFee: number; // 물류비 (네이버: 판매자부담 배송비 / 쿠팡: 풀필먼트비용)
  adFee: number; // 광고비 (네이버: 수기입력 / 쿠팡: 자동, 없으면 0)
  settlementAmount: number; // 정산금 (참고용 — 네이버: 자동, 쿠팡: 0, 오프라인: 수기)
}

// ─── 플랫폼별 이익 계산 결과 ──────────────────────────────────────────────
export interface PlatformProfit {
  profit: number; // 이익 = 매출 - 수수료 - 물류비 - 광고비
  materialCost: number; // 부자재비 (온라인: (매출-물류비)×15% / 오프라인: 매출×20%)
  netProfit: number; // 순이익 = 이익 - 부자재비
}

// ─── 네이버 플랫폼 데이터 ─────────────────────────────────────────────────
export interface NaverData {
  revenue: number; // 결제금액 (판매분석)
  totalQuantity: number; // 전체 판매수량 (취소 제외)
  handmadeQuantity: number; // 끈갈피/북마크/책갈피 판매수량
  otherQuantity: number; // 기타 상품 판매수량
  fees: PlatformFees;
  shippingStats: ShippingStats; // 배송 건수 (네이버 전용)
  profit: PlatformProfit;
  products: ProductSales[]; // 상품별 판매 내역
}

// ─── 쿠팡 플랫폼 데이터 ───────────────────────────────────────────────────
export interface CoupangData {
  revenue: number; // 매출 (정산 페이지)
  totalQuantity: number;
  handmadeQuantity: number;
  otherQuantity: number;
  fees: PlatformFees; // settlementAmount는 0으로 저장
  profit: PlatformProfit;
  products: ProductSales[];
}

// ─── 오프라인 (고산의낮) 데이터 — 전체 수기 입력 ────────────────────────
export interface OfflineData {
  venueName: string; // 입점처명 (기본값: "고산의낮")
  revenue: number;
  totalQuantity: number;
  handmadeQuantity: number;
  otherQuantity: number;
  fees: PlatformFees;
  profit: PlatformProfit; // 자동 계산
  products: ProductSales[];
}

// ─── 전체 합계 ────────────────────────────────────────────────────────────
export interface OverallSummary {
  totalRevenue: number;
  totalCommissionFee: number;
  totalLogisticsFee: number;
  totalAdFee: number;
  totalProfit: number;
  totalMaterialCost: number;
  totalNetProfit: number;
  // 판매량
  totalQuantity: number;
  handmadeQuantity: number;
  otherQuantity: number;
}

// ─── 상품 랭킹 엔트리 ─────────────────────────────────────────────────────
export interface ProductRankEntry {
  rank: number;
  productName: string; // canonical 상품명
  category: ProductCategory;
  total: number;
  naver: number;
  coupang: number;
  offline: number;
}

// ─── 상품 × 플랫폼 판매수량 매트릭스 (섹션3 표) ───────────────────────────
export interface ProductMatrixRow {
  productName: string; // canonical 상품명
  category: ProductCategory;
  naver: number;
  coupang: number;
  offline: number;
  total: number;
}

// ─── 상품 매핑 (네이버↔쿠팡 상품명 연결) ─────────────────────────────────
export interface ProductMapping {
  canonical: string; // 정규화된 대표 상품명
  naver?: string; // 네이버 상품명 (없으면 해당 플랫폼 미판매)
  coupang?: string; // 쿠팡 상품명
}

export interface ProductMappingConfig {
  mappings: ProductMapping[];
  generatedAt: string; // ISO 8601
  confirmedByUser: boolean; // false면 UI에서 확인 요청 배너 표시
}

// ─── Claude AI 인사이트 ───────────────────────────────────────────────────
export interface SalesInsight {
  title: string;
  description: string;
  type: "positive" | "negative" | "neutral" | "action";
}

// ─── 월별 종합 레포트 (저장/편집 단위) ───────────────────────────────────
export interface MonthlyReport {
  period: { year: number; month: number };
  dataRange: { start: string; end: string }; // 수집 기간 (완전성 판단용)
  naver: NaverData;
  coupang: CoupangData;
  offline: OfflineData;
  summary: OverallSummary;
  // 랭킹
  naverRanking: ProductRankEntry[]; // 네이버 TOP3
  coupangRanking: ProductRankEntry[]; // 쿠팡 TOP3
  offlineRanking: ProductRankEntry[]; // 오프라인 TOP3
  overallRanking: ProductRankEntry[]; // 전체 통합 TOP5
  productMatrix: ProductMatrixRow[]; // 상품 × 플랫폼 표
  insights: SalesInsight[];
  collectedAt: string; // ISO 8601
  lastModifiedAt: string; // ISO 8601
}
