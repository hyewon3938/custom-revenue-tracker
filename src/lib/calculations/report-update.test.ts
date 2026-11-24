import { describe, it, expect } from "vitest";
import {
  applyOfflineUpdates,
  recalcPlatformProfits,
  mergeSponsorshipData,
} from "./report-update";
import { calcUnitSponsorshipCost } from "./sponsorship";
import {
  NAVER_SHIPPING_FEE,
  NAVER_SHIPPING_COST,
  COUPANG_SHIPPING_MARKUP,
  ONLINE_MATERIAL_RATE,
  OFFLINE_MATERIAL_RATE,
} from "@/lib/config";
import { DEFAULT_SPONSORSHIP } from "@/lib/constants";
import type {
  CoupangData,
  NaverData,
  OfflineData,
  PlatformFees,
  ProductSales,
  SponsorshipData,
} from "@/lib/types";

// ─── 픽스처 (금액은 임의의 둥근 숫자) ───────────────────────────────────────

const ZERO_PROFIT = { profit: 0, materialCost: 0, netProfit: 0 };

function fees(overrides: Partial<PlatformFees> = {}): PlatformFees {
  return {
    commissionFee: 0,
    logisticsFee: 0,
    inboundShippingFee: 0,
    adFee: 0,
    settlementAmount: 0,
    ...overrides,
  };
}

function product(
  productName: string,
  quantity: number,
  platform: ProductSales["platform"],
  category: ProductSales["category"] = "other",
): ProductSales {
  return { productName, category, platform, quantity };
}

function venue(overrides: Partial<OfflineData> = {}): OfflineData {
  return {
    venueId: "gosan",
    venueName: "고산의낮",
    revenue: 20_000,
    totalQuantity: 0,
    handmadeQuantity: 0,
    otherQuantity: 0,
    fees: fees({ commissionFee: 2_000 }),
    profit: ZERO_PROFIT,
    products: [product("달빛 끈갈피", 2, "offline")],
    ...overrides,
  };
}

function naver(overrides: Partial<NaverData> = {}): NaverData {
  return {
    revenue: 100_000,
    shippingCollected: 6_000,
    payerCount: 5,
    totalQuantity: 99,
    handmadeQuantity: 99,
    otherQuantity: 99,
    fees: fees({
      commissionFee: 5_000,
      logisticsFee: 77_777,
      adFee: 1_000,
      settlementAmount: 90_000,
    }),
    shippingStats: { regularCount: 0, freeCount: 0, sellerCost: 0 },
    profit: ZERO_PROFIT,
    products: [
      product("달빛 끈갈피", 4, "naver"),
      product("금속 독서링 북마크", 1, "naver", "handmade"),
    ],
    ...overrides,
  };
}

function coupang(overrides: Partial<CoupangData> = {}): CoupangData {
  return {
    revenue: 50_000,
    totalQuantity: 99,
    handmadeQuantity: 99,
    otherQuantity: 99,
    fees: fees({
      commissionFee: 4_000,
      logisticsFee: 3_000,
      inboundShippingFee: 1_000,
      adFee: 2_000,
    }),
    profit: ZERO_PROFIT,
    products: [
      product("달빛 북마크", 3, "coupang"),
      product("엽서 세트", 2, "coupang", "handmade"),
    ],
    ...overrides,
  };
}

// ─── applyOfflineUpdates ───────────────────────────────────────────────────

describe("applyOfflineUpdates", () => {
  it("변경 요청이 없으면 내용이 같은 새 배열을 돌려준다", () => {
    const existing = [venue()];
    const result = applyOfflineUpdates(existing, {});
    expect(result).toEqual(existing);
    expect(result).not.toBe(existing);
    expect(result[0]).toBe(existing[0]);
  });

  it("입점처 추가: 0 으로 채운 항목을 맨 뒤에 붙이고 원본 배열은 건드리지 않는다", () => {
    const existing = [venue()];
    const result = applyOfflineUpdates(existing, {
      addOfflineVenue: { id: "new-shop", name: "새 가게" },
    });
    expect(existing).toHaveLength(1);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      venueId: "new-shop",
      venueName: "새 가게",
      revenue: 0,
      totalQuantity: 0,
      handmadeQuantity: 0,
      otherQuantity: 0,
      fees: fees(),
      profit: ZERO_PROFIT,
      products: [],
    });
  });

  it("입점처 추가: 이미 있는 ID 면 무시한다", () => {
    const result = applyOfflineUpdates([venue()], {
      addOfflineVenue: { id: "gosan", name: "다른 이름" },
    });
    expect(result).toHaveLength(1);
    expect(result[0].venueName).toBe("고산의낮");
  });

  it("입점처 제거: 해당 ID 만 빼고, 없는 ID 면 그대로", () => {
    const existing = [venue(), venue({ venueId: "b", venueName: "B" })];
    expect(
      applyOfflineUpdates(existing, { removeOfflineVenueId: "gosan" }).map(
        (v) => v.venueId,
      ),
    ).toEqual(["b"]);
    expect(
      applyOfflineUpdates(existing, { removeOfflineVenueId: "none" }),
    ).toEqual(existing);
  });

  it("입점처 수정: products 가 없으면 병합만 하고 수량은 재계산하지 않는다", () => {
    const result = applyOfflineUpdates([venue({ totalQuantity: 7 })], {
      offlineVenueId: "gosan",
      offline: { revenue: 30_000, fees: { adFee: 500 } },
    });
    expect(result[0].revenue).toBe(30_000);
    expect(result[0].fees).toEqual(fees({ commissionFee: 2_000, adFee: 500 }));
    expect(result[0].totalQuantity).toBe(7);
    expect(result[0].products[0].category).toBe("other");
  });

  it("입점처 수정: products 가 오면 카테고리를 재분류하고 수량을 다시 센다", () => {
    const result = applyOfflineUpdates(
      [venue(), venue({ venueId: "b", venueName: "B" })],
      {
        offlineVenueId: "b",
        offline: {
          products: [
            product("꽃갈피", 3, "offline"),
            product("엽서", 1, "offline", "handmade"),
          ],
        },
      },
    );
    expect(result[0]).toEqual(venue());
    expect(result[1].products.map((p) => p.category)).toEqual([
      "handmade",
      "other",
    ]);
    expect(result[1].totalQuantity).toBe(4);
    expect(result[1].handmadeQuantity).toBe(3);
    expect(result[1].otherQuantity).toBe(1);
  });

  it("offline 과 offlineVenueId 중 하나만 있으면 수정하지 않는다", () => {
    const existing = [venue()];
    expect(
      applyOfflineUpdates(existing, { offline: { revenue: 1 } }),
    ).toEqual(existing);
    expect(
      applyOfflineUpdates(existing, { offlineVenueId: "gosan" }),
    ).toEqual(existing);
  });

  it("추가 → 제거 → 수정 순서로 적용한다", () => {
    // 같은 ID 를 추가하면서 제거하면 제거가 이긴다
    const addThenRemove = applyOfflineUpdates([venue()], {
      addOfflineVenue: { id: "new-shop", name: "새 가게" },
      removeOfflineVenueId: "new-shop",
    });
    expect(addThenRemove.map((v) => v.venueId)).toEqual(["gosan"]);

    // 방금 추가한 입점처를 같은 요청에서 수정할 수 있다
    const addThenEdit = applyOfflineUpdates([venue()], {
      addOfflineVenue: { id: "new-shop", name: "새 가게" },
      offlineVenueId: "new-shop",
      offline: { revenue: 10_000 },
    });
    expect(addThenEdit[1].revenue).toBe(10_000);
  });
});

// ─── recalcPlatformProfits ─────────────────────────────────────────────────

describe("recalcPlatformProfits", () => {
  const regular = Math.round(6_000 / NAVER_SHIPPING_FEE);
  const free = Math.max(0, 5 - regular);
  const sellerCost =
    free * NAVER_SHIPPING_COST +
    regular * (NAVER_SHIPPING_COST - NAVER_SHIPPING_FEE);

  it("네이버: 물류비를 판매자 실배송비로 덮어쓰고 광고비를 0 으로 고정한다", () => {
    const result = recalcPlatformProfits(naver(), coupang(), []);

    expect(result.naver.shippingStats).toEqual({
      regularCount: regular,
      freeCount: free,
      sellerCost,
    });
    expect(result.naver.fees).toEqual(
      fees({
        commissionFee: 5_000,
        logisticsFee: sellerCost,
        adFee: 0,
        settlementAmount: 90_000,
      }),
    );
    const profit = 100_000 - 5_000 - sellerCost;
    const materialCost = Math.round((100_000 - 6_000) * ONLINE_MATERIAL_RATE);
    expect(result.naver.profit).toEqual({
      profit,
      materialCost,
      netProfit: profit - materialCost,
    });
  });

  it("네이버: 카테고리를 재분류하고 수량을 다시 센다 (독서링은 other)", () => {
    const result = recalcPlatformProfits(naver(), coupang(), []);
    expect(result.naver.products.map((p) => p.category)).toEqual([
      "handmade",
      "other",
    ]);
    expect(result.naver.totalQuantity).toBe(5);
    expect(result.naver.handmadeQuantity).toBe(4);
    expect(result.naver.otherQuantity).toBe(1);
  });

  it("네이버: shippingCollected·payerCount 가 없으면 0 으로 계산한다", () => {
    const legacy = {
      ...naver(),
      shippingCollected: undefined,
      payerCount: undefined,
    } as unknown as NaverData;
    const result = recalcPlatformProfits(legacy, coupang(), []);
    expect(result.naver.shippingStats).toEqual({
      regularCount: 0,
      freeCount: 0,
      sellerCost: 0,
    });
    expect(result.naver.fees.logisticsFee).toBe(0);
    expect(result.naver.profit.materialCost).toBe(
      Math.round(100_000 * ONLINE_MATERIAL_RATE),
    );
  });

  it("쿠팡: 비용은 그대로 두고, 부자재 기준에 재분류 후 총수량을 쓴다", () => {
    const input = coupang();
    const result = recalcPlatformProfits(naver(), input, []);

    expect(result.coupang.fees).toEqual(input.fees);
    expect(result.coupang.totalQuantity).toBe(5);
    expect(result.coupang.handmadeQuantity).toBe(3);
    expect(result.coupang.otherQuantity).toBe(2);
    const profit = 50_000 - 4_000 - 3_000 - 1_000 - 2_000;
    // 입력의 totalQuantity(99)가 아니라 다시 센 5 를 사용
    const materialCost = Math.round(
      (50_000 - 5 * COUPANG_SHIPPING_MARKUP) * ONLINE_MATERIAL_RATE,
    );
    expect(result.coupang.profit).toEqual({
      profit,
      materialCost,
      netProfit: profit - materialCost,
    });
  });

  it("오프라인: 입점처마다 재분류 후 이익을 계산하고 gosan 만 수수료를 부자재 기준에 더한다", () => {
    const result = recalcPlatformProfits(naver(), coupang(), [
      venue(),
      venue({ venueId: "b", venueName: "B" }),
    ]);

    const gosanMaterial = Math.round((20_000 + 2_000) * OFFLINE_MATERIAL_RATE);
    const otherMaterial = Math.round(20_000 * OFFLINE_MATERIAL_RATE);
    expect(result.offline.map((v) => v.profit)).toEqual([
      {
        profit: 18_000,
        materialCost: gosanMaterial,
        netProfit: 18_000 - gosanMaterial,
      },
      {
        profit: 18_000,
        materialCost: otherMaterial,
        netProfit: 18_000 - otherMaterial,
      },
    ]);
    expect(result.offline[0].products[0].category).toBe("handmade");
    expect(result.offline[0].totalQuantity).toBe(2);
    expect(result.offline[0].handmadeQuantity).toBe(2);
    expect(result.offline[0].otherQuantity).toBe(0);
  });

  it("입력 객체를 변경하지 않는다", () => {
    const n = naver();
    const c = coupang();
    const o = [venue()];
    const snapshot = JSON.stringify({ n, c, o });
    recalcPlatformProfits(n, c, o);
    expect(JSON.stringify({ n, c, o })).toBe(snapshot);
  });
});

// ─── mergeSponsorshipData ──────────────────────────────────────────────────

describe("mergeSponsorshipData", () => {
  const existing: SponsorshipData = {
    items: [{ productName: "달빛 끈갈피", category: "handmade", quantity: 2 }],
    marketingCost: 30_000,
    totalQuantity: 2,
    handmadeQuantity: 2,
  };

  it("기존 값도 패치도 없으면 기본값을 그대로 돌려준다", () => {
    expect(mergeSponsorshipData(undefined, undefined)).toBe(
      DEFAULT_SPONSORSHIP,
    );
  });

  it("패치가 없으면 기존 값을 그대로 돌려준다", () => {
    expect(mergeSponsorshipData(existing, undefined)).toBe(existing);
  });

  it("items 없는 패치는 병합만 한다 (marketingCost 수기 수정)", () => {
    expect(mergeSponsorshipData(existing, { marketingCost: 45_000 })).toEqual({
      ...existing,
      marketingCost: 45_000,
    });
  });

  it("items 가 바뀌고 단가가 모두 있으면 수량과 비용을 자동 계산한다", () => {
    const result = mergeSponsorshipData(existing, {
      items: [
        {
          productName: "달빛 끈갈피",
          category: "handmade",
          quantity: 2,
          unitPrice: 7_000,
        },
        {
          productName: "금속 독서링",
          category: "other",
          quantity: 1,
          unitPrice: 5_000,
        },
      ],
    });
    expect(result.totalQuantity).toBe(3);
    expect(result.handmadeQuantity).toBe(2);
    expect(result.marketingCost).toBe(
      calcUnitSponsorshipCost(7_000) * 2 + calcUnitSponsorshipCost(5_000),
    );
  });

  it("단가가 하나라도 없으면 수량만 다시 세고 비용은 기존 값을 유지한다", () => {
    const result = mergeSponsorshipData(existing, {
      items: [
        {
          productName: "달빛 끈갈피",
          category: "handmade",
          quantity: 4,
          unitPrice: 7_000,
        },
        { productName: "금속 독서링", category: "other", quantity: 1 },
      ],
    });
    expect(result.totalQuantity).toBe(5);
    expect(result.handmadeQuantity).toBe(4);
    expect(result.marketingCost).toBe(30_000);
  });

  it("단가가 없을 때 패치의 marketingCost 가 있으면 그 값을 쓴다", () => {
    const result = mergeSponsorshipData(existing, {
      marketingCost: 12_000,
      items: [{ productName: "엽서", category: "other", quantity: 1 }],
    });
    expect(result.marketingCost).toBe(12_000);
  });

  it("items 를 비우면 수량과 비용이 모두 0", () => {
    expect(mergeSponsorshipData(existing, { items: [] })).toEqual({
      items: [],
      marketingCost: 0,
      totalQuantity: 0,
      handmadeQuantity: 0,
    });
  });

  it("기존 값이 없으면 기본값 위에 병합하고 기본값 상수는 변경하지 않는다", () => {
    const result = mergeSponsorshipData(undefined, {
      items: [
        {
          productName: "달빛 끈갈피",
          category: "handmade",
          quantity: 1,
          unitPrice: 7_000,
        },
      ],
    });
    expect(result.totalQuantity).toBe(1);
    expect(result.marketingCost).toBe(calcUnitSponsorshipCost(7_000));
    expect(DEFAULT_SPONSORSHIP.items).toEqual([]);
    expect(DEFAULT_SPONSORSHIP.marketingCost).toBe(0);
  });
});
