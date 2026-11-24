/**
 * storage·calculations 테스트 공용 픽스처. 금액은 임의의 둥근 숫자.
 */
import type {
  CoupangData,
  MonthlyReport,
  NaverData,
  OfflineData,
  PlatformFees,
  ProductSales,
} from "@/lib/types";

export function makeFees(overrides: Partial<PlatformFees> = {}): PlatformFees {
  return {
    commissionFee: 0,
    logisticsFee: 0,
    inboundShippingFee: 0,
    adFee: 0,
    settlementAmount: 0,
    ...overrides,
  };
}

export function makeProduct(
  productName: string,
  quantity: number,
  platform: ProductSales["platform"],
  category: ProductSales["category"] = "other",
): ProductSales {
  return { productName, category, platform, quantity };
}

export function makeNaver(overrides: Partial<NaverData> = {}): NaverData {
  return {
    revenue: 100_000,
    shippingCollected: 6_000,
    payerCount: 5,
    totalQuantity: 0,
    handmadeQuantity: 0,
    otherQuantity: 0,
    fees: makeFees({ commissionFee: 5_000, settlementAmount: 90_000 }),
    shippingStats: { regularCount: 0, freeCount: 0, sellerCost: 0 },
    profit: { profit: 0, materialCost: 0, netProfit: 0 },
    products: [makeProduct("달빛 끈갈피", 4, "naver")],
    ...overrides,
  };
}

export function makeCoupang(overrides: Partial<CoupangData> = {}): CoupangData {
  return {
    revenue: 50_000,
    totalQuantity: 0,
    handmadeQuantity: 0,
    otherQuantity: 0,
    fees: makeFees({ commissionFee: 4_000, logisticsFee: 3_000, adFee: 2_000 }),
    profit: { profit: 0, materialCost: 0, netProfit: 0 },
    products: [
      makeProduct("달빛 북마크", 3, "coupang"),
      makeProduct("실버 독서링", 2, "coupang", "handmade"),
    ],
    ...overrides,
  };
}

export function makeVenue(overrides: Partial<OfflineData> = {}): OfflineData {
  return {
    venueId: "gosan",
    venueName: "고산의낮",
    revenue: 20_000,
    totalQuantity: 0,
    handmadeQuantity: 0,
    otherQuantity: 0,
    fees: makeFees({ commissionFee: 2_000 }),
    profit: { profit: 0, materialCost: 0, netProfit: 0 },
    products: [makeProduct("달빛 끈갈피", 2, "offline")],
    ...overrides,
  };
}

export function makeReport(
  year: number,
  month: number,
  overrides: Partial<MonthlyReport> = {},
): MonthlyReport {
  return {
    period: { year, month },
    dataRange: { start: "2025-01-01", end: "2025-01-31" },
    naver: makeNaver(),
    coupang: makeCoupang(),
    offline: [makeVenue()],
    sponsorship: {
      items: [],
      marketingCost: 0,
      totalQuantity: 0,
      handmadeQuantity: 0,
    },
    summary: {
      totalRevenue: 0,
      totalCommissionFee: 0,
      totalLogisticsFee: 0,
      totalInboundShippingFee: 0,
      totalAdFee: 0,
      totalProfit: 0,
      totalMaterialCost: 0,
      marketingCost: 0,
      totalNetProfit: 0,
      totalQuantity: 0,
      handmadeQuantity: 0,
      otherQuantity: 0,
    },
    naverRanking: [],
    coupangRanking: [],
    offlineRanking: [],
    overallRanking: [],
    sponsorExcludedRanking: [],
    productMatrix: [],
    insights: [],
    warnings: [],
    collectedAt: "2025-02-01T00:00:00.000Z",
    lastModifiedAt: "2025-02-01T00:00:00.000Z",
    ...overrides,
  };
}

/** 구버전 데이터 흉내용: 지정한 키를 뺀 얕은 사본 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Omit<T, K> {
  const copy = { ...obj };
  for (const key of keys) delete copy[key];
  return copy;
}
