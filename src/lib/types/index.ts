export type Platform = "naver" | "coupang" | "offline";
export type ProductCategory = "handmade" | "other"; // handmade = 끈갈피/북마크/책갈피

// ─── 배송 건수 (네이버 전용) ───────────────────────────────────────────────
export interface ShippingStats {
  regularCount: number; // 유료배송 건수 (고객이 배송비 지불)
  freeCount: number; // 무료배송 건수 (3만원+ 주문, 판매자 부담)
  sellerCost: number; // 판매자 실배송비 = freeCount × COST + regularCount × (COST - FEE)
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
  adFee: number; // 광고비 (쿠팡: 자동 / 오프라인: 수기 / 네이버: 미사용=0)
  settlementAmount: number; // 정산금 (참고용 — 네이버: 자동, 쿠팡: 0, 오프라인: 수기)
}

// ─── 플랫폼별 이익 계산 결과 ──────────────────────────────────────────────
export interface PlatformProfit {
  profit: number; // 이익 = 매출 - 수수료 - 물류비 - 광고비
  materialCost: number; // 부자재비 (환경변수 비율 적용)
  netProfit: number; // 순이익 = 이익 - 부자재비
}

// ─── 네이버 플랫폼 데이터 ─────────────────────────────────────────────────
export interface NaverData {
  revenue: number; // 결제금액 (판매분석)
  shippingCollected: number; // 고객 배송비 합계 (판매분석에서 수집, 재계산용)
  payerCount: number; // 결제자수 (판매분석에서 수집, 배송 건수 계산용)
  totalQuantity: number; // 전체 판매수량 (취소 제외)
  handmadeQuantity: number; // 끈갈피/북마크 판매수량
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

// ─── 오프라인 입점처 정보 (레지스트리) ────────────────────────────────────
export interface VenueInfo {
  id: string;        // slug 기반 고유 ID (예: "gosan")
  name: string;      // 입점처명 (예: "고산의낮")
  createdAt: string;  // ISO 8601
}

// ─── 오프라인 입점처 데이터 — 전체 수기 입력 ─────────────────────────────
export interface OfflineData {
  venueId: string;   // 입점처 레지스트리 ID 참조
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
  marketingCost: number;    // 협찬 마케팅 비용 (totalNetProfit에서 차감됨)
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

// ─── 협찬 마케팅 데이터 ────────────────────────────────────────────────────

/** 협찬 제공 상품 1건 */
export interface SponsoredItem {
  productName: string;       // canonical 상품명 (productMatrix 기준)
  category: ProductCategory;
  quantity: number;
  unitPrice?: number;        // 협찬 단가 (원) — 있으면 marketingCost 자동 계산
}

/** 협찬 마케팅 전체 데이터 (수기 입력) */
export interface SponsorshipData {
  items: SponsoredItem[];        // 협찬 제공 상품 목록
  marketingCost: number;         // 마케팅 비용 (순이익에서 차감)
  totalQuantity: number;         // 총 협찬 제공 수량 (자동 계산)
  handmadeQuantity: number;      // 끈갈피 협찬 제공 수량 (자동 계산)
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

export type InsightCategory =
  | "revenue"       // 매출 동향
  | "profit"        // 이익률/비용 구조
  | "product"       // 상품 전략
  | "platform"      // 플랫폼 비교
  | "ad"            // 광고 효율
  | "sponsorship"   // 협찬 마케팅 효과
  | "trend";        // 전달 대비 추세

export interface SalesInsight {
  title: string;
  description: string;
  type: "positive" | "negative" | "neutral" | "action";
  category?: InsightCategory;
}

// ─── 인사이트 뷰용 집계 타입 ───────────────────────────────────────────────

/** 전체 인사이트 뷰에서 사용하는 월별 집계 데이터 (차트 X축 단위) */
export interface MonthlyOverview {
  period: { year: number; month: number };
  label: string;              // "2025.12" — 차트 X축 레이블
  totalRevenue: number;
  totalNetProfit: number;
  totalQuantity: number;
  handmadeQuantity: number;
  otherQuantity: number;
  marginRate: number;         // 소수점 1자리 % (서버에서 미리 계산)
  naverRevenue: number;
  coupangRevenue: number;
  offlineRevenue: number;
  // 마케팅 비용
  naverAdFee: number;
  coupangAdFee: number;
  sponsorshipCost: number;    // 협찬 마케팅 비용 (부자재비)
}

/** GET /api/overview 응답 타입 */
export interface OverviewResponse {
  months: MonthlyOverview[];  // 오름차순 정렬 (차트 X축 좌→우)
  totals: {
    totalQuantity: number;
    handmadeQuantity: number;
    totalRevenue: number;
    totalNetProfit: number;
  };
}

// ─── 유틸 타입 ──────────────────────────────────────────────────────────────
export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// ─── 수집 경고 ──────────────────────────────────────────────────────────────
export type WarningLevel = "error" | "warn";

export interface ScrapeWarning {
  level: WarningLevel;
  message: string; // 한국어 사용자 메시지
}

// ─── 월별 종합 레포트 (저장/편집 단위) ───────────────────────────────────
export interface MonthlyReport {
  period: { year: number; month: number };
  dataRange: { start: string; end: string }; // 수집 기간 (완전성 판단용)
  naver: NaverData;
  coupang: CoupangData;
  offline: OfflineData[];
  sponsorship: SponsorshipData;       // 협찬 마케팅 데이터 (수기 입력)
  summary: OverallSummary;
  // 랭킹
  naverRanking: ProductRankEntry[];           // 네이버 TOP3
  coupangRanking: ProductRankEntry[];         // 쿠팡 TOP3
  offlineRanking: ProductRankEntry[];         // 오프라인 TOP3
  overallRanking: ProductRankEntry[];         // 전체 통합 TOP5
  sponsorExcludedRanking: ProductRankEntry[]; // 협찬 제외 TOP5
  productMatrix: ProductMatrixRow[]; // 상품 × 플랫폼 표
  insights: SalesInsight[];
  insightsGeneratedAt?: string; // ISO 8601 — 인사이트가 마지막으로 생성된 시각
  warnings: ScrapeWarning[];  // 수집 시 경고
  collectedAt: string; // ISO 8601
  lastModifiedAt: string; // ISO 8601
}
