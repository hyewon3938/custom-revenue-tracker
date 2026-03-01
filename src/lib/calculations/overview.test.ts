import { describe, test, expect } from "vitest";
import { buildOverviewData } from "./overview";
import type { MonthlyReport } from "@/lib/types";

// ─── 테스트 픽스처 헬퍼 ────────────────────────────────────────────────────

/** 최소한의 MonthlyReport 생성 (overview 계산에 필요한 필드만) */
function makeReport(overrides: {
  year: number;
  month: number;
  totalRevenue?: number;
  totalNetProfit?: number;
  totalQuantity?: number;
  handmadeQuantity?: number;
  otherQuantity?: number;
  naverRevenue?: number;
  coupangRevenue?: number;
  offlineRevenues?: number[];
  naverAdFee?: number;
  coupangAdFee?: number;
  marketingCost?: number;
}): MonthlyReport {
  const {
    year,
    month,
    totalRevenue = 0,
    totalNetProfit = 0,
    totalQuantity = 0,
    handmadeQuantity = 0,
    otherQuantity = 0,
    naverRevenue = 0,
    coupangRevenue = 0,
    offlineRevenues = [],
    naverAdFee = 0,
    coupangAdFee = 0,
    marketingCost = 0,
  } = overrides;

  const emptyFees = { commissionFee: 0, logisticsFee: 0, adFee: 0, settlementAmount: 0 };
  const emptyProfit = { profit: 0, materialCost: 0, netProfit: 0 };

  return {
    period: { year, month },
    dataRange: { start: `${year}-${String(month).padStart(2, "0")}-01`, end: `${year}-${String(month).padStart(2, "0")}-28` },
    naver: {
      revenue: naverRevenue,
      shippingCollected: 0,
      payerCount: 0,
      totalQuantity: 0,
      handmadeQuantity: 0,
      otherQuantity: 0,
      fees: { ...emptyFees, adFee: naverAdFee },
      shippingStats: { regularCount: 0, freeCount: 0, sellerCost: 0 },
      profit: emptyProfit,
      products: [],
    },
    coupang: {
      revenue: coupangRevenue,
      totalQuantity: 0,
      handmadeQuantity: 0,
      otherQuantity: 0,
      fees: { ...emptyFees, adFee: coupangAdFee },
      profit: emptyProfit,
      products: [],
    },
    offline: offlineRevenues.map((rev, i) => ({
      venueId: `venue-${i}`,
      venueName: `입점처${i}`,
      revenue: rev,
      totalQuantity: 0,
      handmadeQuantity: 0,
      otherQuantity: 0,
      fees: emptyFees,
      profit: emptyProfit,
      products: [],
    })),
    sponsorship: { items: [], marketingCost, totalQuantity: 0, handmadeQuantity: 0 },
    summary: {
      totalRevenue,
      totalCommissionFee: 0,
      totalLogisticsFee: 0,
      totalAdFee: 0,
      totalProfit: 0,
      totalMaterialCost: 0,
      marketingCost,
      totalNetProfit,
      totalQuantity,
      handmadeQuantity,
      otherQuantity,
    },
    naverRanking: [],
    coupangRanking: [],
    offlineRanking: [],
    overallRanking: [],
    sponsorExcludedRanking: [],
    productMatrix: [],
    insights: [],
    warnings: [],
    collectedAt: "2026-01-15T00:00:00Z",
    lastModifiedAt: "2026-01-15T00:00:00Z",
  };
}

// ─── buildOverviewData ──────────────────────────────────────────────────────

describe("buildOverviewData", () => {
  test("월별 레이블을 'YYYY.MM' 형식으로 생성한다", () => {
    const reports = [makeReport({ year: 2025, month: 3 })];
    const result = buildOverviewData(reports);
    expect(result.months[0].label).toBe("2025.03");
  });

  test("한 자리 월은 0으로 패딩한다", () => {
    const reports = [makeReport({ year: 2025, month: 1 })];
    const result = buildOverviewData(reports);
    expect(result.months[0].label).toBe("2025.01");
  });

  test("월별 오름차순으로 정렬한다", () => {
    const reports = [
      makeReport({ year: 2025, month: 12 }),
      makeReport({ year: 2025, month: 3 }),
      makeReport({ year: 2026, month: 1 }),
    ];
    const result = buildOverviewData(reports);
    expect(result.months.map((m) => m.label)).toEqual([
      "2025.03",
      "2025.12",
      "2026.01",
    ]);
  });

  test("연도가 다른 경우 연도 우선 정렬한다", () => {
    const reports = [
      makeReport({ year: 2026, month: 2 }),
      makeReport({ year: 2025, month: 11 }),
    ];
    const result = buildOverviewData(reports);
    expect(result.months[0].label).toBe("2025.11");
    expect(result.months[1].label).toBe("2026.02");
  });

  test("매출/순이익/수량을 올바르게 매핑한다", () => {
    const reports = [
      makeReport({
        year: 2025,
        month: 10,
        totalRevenue: 500000,
        totalNetProfit: 150000,
        totalQuantity: 50,
        handmadeQuantity: 40,
        otherQuantity: 10,
      }),
    ];
    const result = buildOverviewData(reports);
    const m = result.months[0];
    expect(m.totalRevenue).toBe(500000);
    expect(m.totalNetProfit).toBe(150000);
    expect(m.totalQuantity).toBe(50);
    expect(m.handmadeQuantity).toBe(40);
    expect(m.otherQuantity).toBe(10);
  });

  test("마진율을 소수점 1자리까지 계산한다", () => {
    const reports = [
      makeReport({
        year: 2025,
        month: 10,
        totalRevenue: 200000,
        totalNetProfit: 65000,
      }),
    ];
    const result = buildOverviewData(reports);
    // marginRate = round((65000/200000) * 1000) / 10 = round(325) / 10 = 32.5
    expect(result.months[0].marginRate).toBe(32.5);
  });

  test("매출이 0이면 마진율은 0이다", () => {
    const reports = [
      makeReport({ year: 2025, month: 10, totalRevenue: 0, totalNetProfit: 0 }),
    ];
    const result = buildOverviewData(reports);
    expect(result.months[0].marginRate).toBe(0);
  });

  test("플랫폼별 매출을 분리 매핑한다", () => {
    const reports = [
      makeReport({
        year: 2025,
        month: 10,
        naverRevenue: 100000,
        coupangRevenue: 80000,
        offlineRevenues: [30000, 20000],
      }),
    ];
    const result = buildOverviewData(reports);
    const m = result.months[0];
    expect(m.naverRevenue).toBe(100000);
    expect(m.coupangRevenue).toBe(80000);
    expect(m.offlineRevenue).toBe(50000); // 30000 + 20000
  });

  test("마케팅 비용을 매핑한다", () => {
    const reports = [
      makeReport({
        year: 2025,
        month: 10,
        naverAdFee: 5000,
        coupangAdFee: 3000,
        marketingCost: 10000,
      }),
    ];
    const result = buildOverviewData(reports);
    const m = result.months[0];
    expect(m.naverAdFee).toBe(5000);
    expect(m.coupangAdFee).toBe(3000);
    expect(m.sponsorshipCost).toBe(10000);
  });

  test("sponsorship이 없는 레포트는 sponsorshipCost가 0이다", () => {
    const report = makeReport({ year: 2025, month: 10 });
    // sponsorship을 undefined로 설정 (옛날 데이터 시나리오)
    (report as unknown as Record<string, unknown>).sponsorship = undefined;
    const result = buildOverviewData([report]);
    expect(result.months[0].sponsorshipCost).toBe(0);
  });

  test("totals에 전체 기간 합계를 계산한다", () => {
    const reports = [
      makeReport({
        year: 2025,
        month: 10,
        totalRevenue: 200000,
        totalNetProfit: 60000,
        totalQuantity: 20,
        handmadeQuantity: 15,
      }),
      makeReport({
        year: 2025,
        month: 11,
        totalRevenue: 300000,
        totalNetProfit: 90000,
        totalQuantity: 30,
        handmadeQuantity: 25,
      }),
    ];
    const result = buildOverviewData(reports);
    expect(result.totals.totalRevenue).toBe(500000);
    expect(result.totals.totalNetProfit).toBe(150000);
    expect(result.totals.totalQuantity).toBe(50);
    expect(result.totals.handmadeQuantity).toBe(40);
  });

  test("빈 레포트 배열은 빈 months와 0인 totals를 반환한다", () => {
    const result = buildOverviewData([]);
    expect(result.months).toEqual([]);
    expect(result.totals).toEqual({
      totalQuantity: 0,
      handmadeQuantity: 0,
      totalRevenue: 0,
      totalNetProfit: 0,
    });
  });

  test("period 정보를 유지한다", () => {
    const reports = [makeReport({ year: 2025, month: 7 })];
    const result = buildOverviewData(reports);
    expect(result.months[0].period).toEqual({ year: 2025, month: 7 });
  });
});
