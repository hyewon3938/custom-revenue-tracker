import { describe, test, expect } from "vitest";
import {
  calcPlatformProfit,
  calcNaverShippingStats,
  naverMaterialBase,
  coupangMaterialBase,
  gosanMaterialBase,
  calcOfflineVenueProfit,
  calcOverallSummary,
} from "./profit";
import type {
  PlatformFees,
  NaverData,
  CoupangData,
  OfflineData,
} from "@/lib/types";

// ─── 테스트 픽스처 헬퍼 ────────────────────────────────────────────────────

function makeFees(overrides: Partial<PlatformFees> = {}): PlatformFees {
  return {
    commissionFee: 0,
    logisticsFee: 0,
    adFee: 0,
    settlementAmount: 0,
    ...overrides,
  };
}

function makeOfflineVenue(
  overrides: Partial<OfflineData> & { venueId: string }
): OfflineData {
  return {
    venueName: overrides.venueId,
    revenue: 0,
    totalQuantity: 0,
    handmadeQuantity: 0,
    otherQuantity: 0,
    fees: makeFees(),
    profit: { profit: 0, materialCost: 0, netProfit: 0 },
    products: [],
    ...overrides,
  };
}

// ─── calcPlatformProfit ────────────────────────────────────────────────────

describe("calcPlatformProfit", () => {
  test("매출에서 수수료, 물류비, 광고비를 차감한 이익을 계산한다", () => {
    const fees = makeFees({
      commissionFee: 5000,
      logisticsFee: 3000,
      adFee: 2000,
    });
    const result = calcPlatformProfit(100000, fees, 100000);
    // profit = 100000 - 5000 - 3000 - 2000 = 90000
    expect(result.profit).toBe(90000);
  });

  test("기본 materialRate(0.15)로 부자재비를 계산한다", () => {
    const fees = makeFees();
    const result = calcPlatformProfit(80000, fees, 80000);
    // materialCost = round(80000 * 0.15) = 12000
    expect(result.materialCost).toBe(12000);
    // netProfit = 80000 - 12000 = 68000
    expect(result.netProfit).toBe(68000);
  });

  test("커스텀 materialRate를 적용한다", () => {
    const fees = makeFees({ commissionFee: 1000 });
    const result = calcPlatformProfit(50000, fees, 50000, 0.2);
    // profit = 50000 - 1000 = 49000
    // materialCost = round(50000 * 0.2) = 10000
    // netProfit = 49000 - 10000 = 39000
    expect(result.profit).toBe(49000);
    expect(result.materialCost).toBe(10000);
    expect(result.netProfit).toBe(39000);
  });

  test("materialBase와 revenue가 다를 수 있다", () => {
    const fees = makeFees({ commissionFee: 2000 });
    // revenue=60000이지만 materialBase=50000 (배송비 제외 등)
    const result = calcPlatformProfit(60000, fees, 50000);
    expect(result.profit).toBe(58000); // 60000 - 2000
    expect(result.materialCost).toBe(7500); // round(50000 * 0.15)
    expect(result.netProfit).toBe(50500); // 58000 - 7500
  });

  test("비용이 매출보다 클 때 음수 이익이 나온다", () => {
    const fees = makeFees({ commissionFee: 60000, logisticsFee: 50000 });
    const result = calcPlatformProfit(10000, fees, 10000);
    expect(result.profit).toBe(-100000);
    expect(result.netProfit).toBeLessThan(0);
  });

  test("매출과 비용이 모두 0이면 모든 값이 0이다", () => {
    const fees = makeFees();
    const result = calcPlatformProfit(0, fees, 0);
    expect(result).toEqual({ profit: 0, materialCost: 0, netProfit: 0 });
  });

  test("materialCost는 반올림된다", () => {
    const fees = makeFees();
    // 33333 * 0.15 = 4999.95 → round → 5000
    const result = calcPlatformProfit(33333, fees, 33333);
    expect(result.materialCost).toBe(5000);
  });
});

// ─── calcNaverShippingStats ────────────────────────────────────────────────

describe("calcNaverShippingStats", () => {
  test("유료배송 건수와 무료배송 건수를 정확히 계산한다", () => {
    // shippingCollected=9000 → regularCount = 9000/3000 = 3
    // payerCount=5 → freeCount = 5 - 3 = 2
    const result = calcNaverShippingStats(9000, 5);
    expect(result.regularCount).toBe(3);
    expect(result.freeCount).toBe(2);
  });

  test("판매자 실배송비를 계산한다", () => {
    const result = calcNaverShippingStats(9000, 5);
    // sellerCost = 2*3300 + 3*(3300-3000) = 6600 + 900 = 7500
    expect(result.sellerCost).toBe(7500);
  });

  test("모든 주문이 유료배송이면 freeCount가 0이다", () => {
    const result = calcNaverShippingStats(15000, 5);
    expect(result.regularCount).toBe(5);
    expect(result.freeCount).toBe(0);
    // sellerCost = 0*3300 + 5*(3300-3000) = 1500
    expect(result.sellerCost).toBe(1500);
  });

  test("모든 주문이 무료배송이면 regularCount가 0이다", () => {
    const result = calcNaverShippingStats(0, 4);
    expect(result.regularCount).toBe(0);
    expect(result.freeCount).toBe(4);
    // sellerCost = 4*3300 + 0 = 13200
    expect(result.sellerCost).toBe(13200);
  });

  test("결제자가 0명이면 모든 값이 0이다", () => {
    const result = calcNaverShippingStats(0, 0);
    expect(result).toEqual({ regularCount: 0, freeCount: 0, sellerCost: 0 });
  });

  test("freeCount는 0 미만이 될 수 없다 (Math.max 클램프)", () => {
    // shippingCollected가 payerCount보다 많은 건수를 만들어낼 경우
    // regularCount = round(30000/3000) = 10, payerCount=3 → freeCount = max(0, 3-10) = 0
    const result = calcNaverShippingStats(30000, 3);
    expect(result.freeCount).toBe(0);
  });
});

// ─── materialBase 헬퍼 ────────────────────────────────────────────────────

describe("naverMaterialBase", () => {
  test("매출에서 고객 배송비를 뺀다", () => {
    expect(naverMaterialBase(70000, 6000)).toBe(64000);
  });

  test("배송비가 0이면 매출 그대로 반환한다", () => {
    expect(naverMaterialBase(50000, 0)).toBe(50000);
  });
});

describe("coupangMaterialBase", () => {
  test("매출에서 배송 마크업 총액을 뺀다", () => {
    // 80000 - 5 * 2000 = 70000
    expect(coupangMaterialBase(80000, 5)).toBe(70000);
  });

  test("수량이 0이면 매출 그대로 반환한다", () => {
    expect(coupangMaterialBase(40000, 0)).toBe(40000);
  });
});

describe("gosanMaterialBase", () => {
  test("매출(할인가)에 수수료(할인분)를 더해 정가 기준으로 복원한다", () => {
    expect(gosanMaterialBase(30000, 5000)).toBe(35000);
  });
});

// ─── calcOfflineVenueProfit ────────────────────────────────────────────────

describe("calcOfflineVenueProfit", () => {
  test("gosan 입점처는 gosanMaterialBase를 사용한다", () => {
    const venue = makeOfflineVenue({
      venueId: "gosan",
      revenue: 40000,
      fees: makeFees({ commissionFee: 8000 }),
    });
    const result = calcOfflineVenueProfit(venue);
    // materialBase = 40000 + 8000 = 48000
    // materialCost = round(48000 * 0.2) = 9600
    // profit = 40000 - 8000 = 32000
    // netProfit = 32000 - 9600 = 22400
    expect(result.profit.materialCost).toBe(9600);
    expect(result.profit.profit).toBe(32000);
    expect(result.profit.netProfit).toBe(22400);
  });

  test("gosan이 아닌 입점처는 revenue를 materialBase로 사용한다", () => {
    const venue = makeOfflineVenue({
      venueId: "bookshop",
      revenue: 50000,
      fees: makeFees({ commissionFee: 10000 }),
    });
    const result = calcOfflineVenueProfit(venue);
    // materialBase = 50000 (revenue 그대로)
    // materialCost = round(50000 * 0.2) = 10000
    // profit = 50000 - 10000 = 40000
    // netProfit = 40000 - 10000 = 30000
    expect(result.profit.materialCost).toBe(10000);
    expect(result.profit.profit).toBe(40000);
    expect(result.profit.netProfit).toBe(30000);
  });

  test("원본 venue 데이터를 변경하지 않는다 (불변성)", () => {
    const venue = makeOfflineVenue({
      venueId: "gosan",
      revenue: 20000,
      fees: makeFees({ commissionFee: 4000 }),
    });
    const original = { ...venue.profit };
    calcOfflineVenueProfit(venue);
    expect(venue.profit).toEqual(original);
  });
});

// ─── calcOverallSummary ────────────────────────────────────────────────────

describe("calcOverallSummary", () => {
  const naverData: NaverData = {
    revenue: 100000,
    shippingCollected: 6000,
    payerCount: 5,
    totalQuantity: 10,
    handmadeQuantity: 8,
    otherQuantity: 2,
    fees: makeFees({ commissionFee: 5000, logisticsFee: 3000, adFee: 1000 }),
    shippingStats: { regularCount: 2, freeCount: 3, sellerCost: 5000 },
    profit: { profit: 91000, materialCost: 14100, netProfit: 76900 },
    products: [],
  };

  const coupangData: CoupangData = {
    revenue: 80000,
    totalQuantity: 8,
    handmadeQuantity: 6,
    otherQuantity: 2,
    fees: makeFees({ commissionFee: 4000, logisticsFee: 2000, adFee: 500 }),
    profit: { profit: 73500, materialCost: 9000, netProfit: 64500 },
    products: [],
  };

  const offlineVenues: OfflineData[] = [
    makeOfflineVenue({
      venueId: "gosan",
      venueName: "고산의낮",
      revenue: 50000,
      totalQuantity: 5,
      handmadeQuantity: 4,
      otherQuantity: 1,
      fees: makeFees({ commissionFee: 8000, logisticsFee: 1000, adFee: 0 }),
      profit: { profit: 41000, materialCost: 11600, netProfit: 29400 },
    }),
  ];

  test("전체 매출을 합산한다", () => {
    const result = calcOverallSummary(naverData, coupangData, offlineVenues);
    expect(result.totalRevenue).toBe(230000);
  });

  test("전체 비용 항목별로 합산한다", () => {
    const result = calcOverallSummary(naverData, coupangData, offlineVenues);
    expect(result.totalCommissionFee).toBe(17000); // 5000+4000+8000
    expect(result.totalLogisticsFee).toBe(6000); // 3000+2000+1000
    expect(result.totalAdFee).toBe(1500); // 1000+500+0
  });

  test("전체 이익과 순이익을 합산한다", () => {
    const result = calcOverallSummary(naverData, coupangData, offlineVenues);
    expect(result.totalProfit).toBe(205500); // 91000+73500+41000
    expect(result.totalMaterialCost).toBe(34700); // 14100+9000+11600
    expect(result.totalNetProfit).toBe(170800); // 76900+64500+29400
  });

  test("전체 판매수량을 합산한다", () => {
    const result = calcOverallSummary(naverData, coupangData, offlineVenues);
    expect(result.totalQuantity).toBe(23);
    expect(result.handmadeQuantity).toBe(18);
    expect(result.otherQuantity).toBe(5);
  });

  test("marketingCost가 있으면 totalNetProfit에서 차감한다", () => {
    const result = calcOverallSummary(naverData, coupangData, offlineVenues, 5000);
    expect(result.marketingCost).toBe(5000);
    expect(result.totalNetProfit).toBe(165800); // 170800 - 5000
  });

  test("marketingCost 기본값은 0이다", () => {
    const result = calcOverallSummary(naverData, coupangData, offlineVenues);
    expect(result.marketingCost).toBe(0);
  });

  test("다중 오프라인 입점처를 합산한다", () => {
    const multiVenues: OfflineData[] = [
      makeOfflineVenue({
        venueId: "gosan",
        revenue: 30000,
        totalQuantity: 3,
        handmadeQuantity: 2,
        otherQuantity: 1,
        fees: makeFees({ commissionFee: 5000 }),
        profit: { profit: 25000, materialCost: 7000, netProfit: 18000 },
      }),
      makeOfflineVenue({
        venueId: "bookshop",
        revenue: 20000,
        totalQuantity: 2,
        handmadeQuantity: 2,
        otherQuantity: 0,
        fees: makeFees({ commissionFee: 3000 }),
        profit: { profit: 17000, materialCost: 4000, netProfit: 13000 },
      }),
    ];
    const result = calcOverallSummary(naverData, coupangData, multiVenues);
    expect(result.totalRevenue).toBe(230000); // 100000+80000+30000+20000
    expect(result.totalQuantity).toBe(23); // 10+8+3+2
  });

  test("오프라인 입점처가 없으면 온라인만 합산한다", () => {
    const result = calcOverallSummary(naverData, coupangData, []);
    expect(result.totalRevenue).toBe(180000);
    expect(result.totalQuantity).toBe(18);
  });
});
