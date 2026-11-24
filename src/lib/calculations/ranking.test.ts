import { describe, test, expect } from "vitest";
import {
  calcPlatformRanking,
  calcOverallRanking,
  calcSponsorExcludedRanking,
  calcProductMatrix,
  rebuildDerivedFields,
} from "./ranking";
import type {
  ProductSales,
  ProductMappingConfig,
  SponsoredItem,
  NaverData,
  CoupangData,
  OfflineData,
  SponsorshipData,
} from "@/lib/types";

// ─── 테스트 픽스처 헬퍼 ────────────────────────────────────────────────────

function makeProduct(
  name: string,
  quantity: number,
  platform: "naver" | "coupang" | "offline" = "naver",
  category: "handmade" | "other" = "handmade",
): ProductSales {
  return { productName: name, category, platform, quantity };
}

const testMapping: ProductMappingConfig = {
  mappings: [
    {
      canonical: "벚꽃 끈갈피",
      naver: "[리커밋] 벚꽃 끈갈피",
      coupang: "벚꽃 비즈 북마크",
    },
    {
      canonical: "라벤더 끈갈피",
      naver: "[리커밋] 라벤더 끈갈피",
      coupang: "라벤더 비즈 북마크",
    },
    {
      canonical: "해바라기 끈갈피",
      naver: "[리커밋] 해바라기 끈갈피",
      coupang: "해바라기 비즈 북마크",
    },
  ],
  generatedAt: "2026-01-01T00:00:00Z",
  confirmedByUser: true,
};

// ─── calcPlatformRanking ────────────────────────────────────────────────────

describe("calcPlatformRanking", () => {
  test("수량 기준으로 내림차순 정렬하고 상위 N개만 반환한다", () => {
    const products: ProductSales[] = [
      makeProduct("상품A", 5),
      makeProduct("상품B", 12),
      makeProduct("상품C", 3),
      makeProduct("상품D", 8),
    ];
    const result = calcPlatformRanking(products, 3);
    expect(result).toHaveLength(3);
    expect(result[0].productName).toBe("상품B");
    expect(result[0].total).toBe(12);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
    expect(result[2].rank).toBe(3);
  });

  test("플랫폼별 수량 필드를 올바르게 설정한다 (네이버)", () => {
    const products = [makeProduct("상품A", 10, "naver")];
    const result = calcPlatformRanking(products, 1);
    expect(result[0].naver).toBe(10);
    expect(result[0].coupang).toBe(0);
    expect(result[0].offline).toBe(0);
  });

  test("플랫폼별 수량 필드를 올바르게 설정한다 (쿠팡)", () => {
    const products = [makeProduct("상품A", 7, "coupang")];
    const result = calcPlatformRanking(products, 1);
    expect(result[0].naver).toBe(0);
    expect(result[0].coupang).toBe(7);
    expect(result[0].offline).toBe(0);
  });

  test("매핑이 있으면 canonical명으로 합산한다", () => {
    const products: ProductSales[] = [
      makeProduct("[리커밋] 벚꽃 끈갈피", 5, "naver"),
      makeProduct("[리커밋] 벚꽃 끈갈피", 3, "naver"),
    ];
    const result = calcPlatformRanking(products, 3, testMapping);
    expect(result[0].productName).toBe("벚꽃 끈갈피");
    expect(result[0].total).toBe(8);
  });

  test("매핑이 null이면 상품명 그대로 사용한다", () => {
    const products = [makeProduct("원본 상품명", 4, "naver")];
    const result = calcPlatformRanking(products, 3, null);
    expect(result[0].productName).toBe("원본 상품명");
  });

  test("상품이 topN보다 적으면 있는 만큼만 반환한다", () => {
    const products = [makeProduct("상품A", 5, "naver")];
    const result = calcPlatformRanking(products, 3);
    expect(result).toHaveLength(1);
  });

  test("카테고리를 올바르게 유지한다", () => {
    const products = [makeProduct("독서링 세트", 3, "naver", "other")];
    const result = calcPlatformRanking(products, 1);
    expect(result[0].category).toBe("other");
  });
});

// ─── calcOverallRanking ────────────────────────────────────────────────────

describe("calcOverallRanking", () => {
  test("전체 플랫폼 통합 수량 기준으로 TOP N을 산출한다", () => {
    const naver = [
      makeProduct("상품A", 5, "naver"),
      makeProduct("상품B", 3, "naver"),
    ];
    const coupang = [
      makeProduct("상품A", 4, "coupang"),
      makeProduct("상품C", 7, "coupang"),
    ];
    const offline = [makeProduct("상품B", 2, "offline")];

    const result = calcOverallRanking(naver, coupang, offline, null, 3);
    expect(result).toHaveLength(3);
    // 상품A: 5+4=9, 상품C: 7, 상품B: 3+2=5
    expect(result[0].productName).toBe("상품A");
    expect(result[0].total).toBe(9);
    expect(result[0].naver).toBe(5);
    expect(result[0].coupang).toBe(4);
    expect(result[0].offline).toBe(0);
    expect(result[1].productName).toBe("상품C");
    expect(result[2].productName).toBe("상품B");
  });

  test("매핑을 사용하면 다른 플랫폼 상품명을 canonical으로 합산한다", () => {
    const naver = [makeProduct("[리커밋] 벚꽃 끈갈피", 5, "naver")];
    const coupang = [makeProduct("벚꽃 비즈 북마크", 3, "coupang")];
    const offline: ProductSales[] = [];

    const result = calcOverallRanking(naver, coupang, offline, testMapping, 5);
    expect(result).toHaveLength(1);
    expect(result[0].productName).toBe("벚꽃 끈갈피");
    expect(result[0].total).toBe(8);
    expect(result[0].naver).toBe(5);
    expect(result[0].coupang).toBe(3);
  });

  test("rank가 1부터 순서대로 부여된다", () => {
    const naver = [
      makeProduct("상품A", 10, "naver"),
      makeProduct("상품B", 5, "naver"),
      makeProduct("상품C", 1, "naver"),
    ];
    const result = calcOverallRanking(naver, [], [], null, 3);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  test("빈 상품 목록이면 빈 배열을 반환한다", () => {
    const result = calcOverallRanking([], [], [], null, 5);
    expect(result).toEqual([]);
  });
});

// ─── calcSponsorExcludedRanking ─────────────────────────────────────────────

describe("calcSponsorExcludedRanking", () => {
  test("협찬 수량을 total에서 차감한다", () => {
    const naver = [makeProduct("벚꽃 끈갈피", 10, "naver")];
    const sponsored: SponsoredItem[] = [
      { productName: "벚꽃 끈갈피", category: "handmade", quantity: 3 },
    ];

    const result = calcSponsorExcludedRanking(
      naver,
      [],
      [],
      sponsored,
      null,
      5,
    );
    expect(result[0].total).toBe(7); // 10 - 3
    // naver 필드는 원본 수량 유지
    expect(result[0].naver).toBe(10);
  });

  test("협찬 차감 후 total이 0이면 목록에서 제외한다", () => {
    const naver = [makeProduct("상품A", 3, "naver")];
    const sponsored: SponsoredItem[] = [
      { productName: "상품A", category: "handmade", quantity: 5 },
    ];

    const result = calcSponsorExcludedRanking(
      naver,
      [],
      [],
      sponsored,
      null,
      5,
    );
    // total = max(0, 3-5) = 0 → filter로 제거됨
    expect(result).toHaveLength(0);
  });

  test("협찬 목록에 없는 상품은 영향받지 않는다", () => {
    const naver = [makeProduct("상품X", 8, "naver")];
    const sponsored: SponsoredItem[] = [
      { productName: "상품Y", category: "handmade", quantity: 3 },
    ];

    const result = calcSponsorExcludedRanking(
      naver,
      [],
      [],
      sponsored,
      null,
      5,
    );
    expect(result[0].total).toBe(8);
  });

  test("협찬 차감 후 순위가 재정렬된다", () => {
    const naver = [
      makeProduct("상품A", 10, "naver"),
      makeProduct("상품B", 8, "naver"),
    ];
    const sponsored: SponsoredItem[] = [
      { productName: "상품A", category: "handmade", quantity: 5 },
    ];

    const result = calcSponsorExcludedRanking(
      naver,
      [],
      [],
      sponsored,
      null,
      5,
    );
    // 상품A: 10-5=5, 상품B: 8
    expect(result[0].productName).toBe("상품B");
    expect(result[0].rank).toBe(1);
    expect(result[1].productName).toBe("상품A");
    expect(result[1].rank).toBe(2);
  });

  test("매핑과 함께 동작한다", () => {
    const naver = [makeProduct("[리커밋] 벚꽃 끈갈피", 10, "naver")];
    const coupang = [makeProduct("벚꽃 비즈 북마크", 5, "coupang")];
    const sponsored: SponsoredItem[] = [
      { productName: "벚꽃 끈갈피", category: "handmade", quantity: 4 },
    ];

    const result = calcSponsorExcludedRanking(
      naver,
      coupang,
      [],
      sponsored,
      testMapping,
      5,
    );
    // 벚꽃 끈갈피: 10+5=15, 협찬 4 차감 → 11
    expect(result[0].productName).toBe("벚꽃 끈갈피");
    expect(result[0].total).toBe(11);
  });
});

// ─── calcProductMatrix ──────────────────────────────────────────────────────

describe("calcProductMatrix", () => {
  test("플랫폼별 수량과 total을 정확히 집계한다", () => {
    const naver = [makeProduct("상품A", 5, "naver")];
    const coupang = [makeProduct("상품A", 3, "coupang")];
    const offline = [makeProduct("상품A", 2, "offline")];

    const result = calcProductMatrix(naver, coupang, offline, null);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      productName: "상품A",
      category: "handmade",
      naver: 5,
      coupang: 3,
      offline: 2,
      total: 10,
    });
  });

  test("total 내림차순으로 정렬한다", () => {
    const naver = [
      makeProduct("상품A", 2, "naver"),
      makeProduct("상품B", 8, "naver"),
    ];
    const result = calcProductMatrix(naver, [], [], null);
    expect(result[0].productName).toBe("상품B");
    expect(result[1].productName).toBe("상품A");
  });

  test("매핑에 등록된 상품은 판매가 없어도 0으로 포함된다", () => {
    const result = calcProductMatrix([], [], [], testMapping);
    expect(result).toHaveLength(3);
    result.forEach((row) => {
      expect(row.total).toBe(0);
      expect(row.naver).toBe(0);
      expect(row.coupang).toBe(0);
      expect(row.offline).toBe(0);
    });
  });

  test("매핑이 있으면 canonical명으로 통합한다", () => {
    const naver = [makeProduct("[리커밋] 벚꽃 끈갈피", 5, "naver")];
    const coupang = [makeProduct("벚꽃 비즈 북마크", 3, "coupang")];

    const result = calcProductMatrix(naver, coupang, [], testMapping);
    const cherry = result.find((r) => r.productName === "벚꽃 끈갈피");
    expect(cherry).toBeDefined();
    expect(cherry!.naver).toBe(5);
    expect(cherry!.coupang).toBe(3);
    expect(cherry!.total).toBe(8);
  });

  test("빈 상품 목록과 null 매핑이면 빈 배열을 반환한다", () => {
    const result = calcProductMatrix([], [], [], null);
    expect(result).toEqual([]);
  });

  test("실제 판매 데이터로 카테고리가 보정된다", () => {
    // 매핑 초기화 시 category="handmade"로 설정되지만
    // 실제 판매 데이터에서 category="other"인 경우 보정
    const mapping: ProductMappingConfig = {
      mappings: [{ canonical: "독서링", naver: "독서링" }],
      generatedAt: "2026-01-01T00:00:00Z",
      confirmedByUser: true,
    };
    const naver = [makeProduct("독서링", 3, "naver", "other")];
    const result = calcProductMatrix(naver, [], [], mapping);
    const ring = result.find((r) => r.productName === "독서링");
    expect(ring!.category).toBe("other");
  });
});

// ─── 동률·경계 분기 고정 ─────────────────────────────────────────────────────

describe("랭킹 동률과 경계 분기", () => {
  test("calcPlatformRanking: 수량이 같으면 처음 나온 순서를 유지한다", () => {
    const products = [
      makeProduct("B", 5),
      makeProduct("A", 5),
      makeProduct("C", 7),
      makeProduct("D", 5),
    ];
    const result = calcPlatformRanking(products, 4);
    expect(result.map((r) => r.productName)).toEqual(["C", "B", "A", "D"]);
  });

  test("calcPlatformRanking: 빈 목록이면 빈 배열을 반환한다", () => {
    expect(calcPlatformRanking([], 3)).toEqual([]);
  });

  test("calcPlatformRanking: 합산된 상품의 카테고리는 처음 나온 원본 상품을 따른다", () => {
    const products = [
      makeProduct("[리커밋] 벚꽃 끈갈피", 1, "naver", "other"),
      makeProduct("[리커밋] 벚꽃 끈갈피", 2, "naver", "handmade"),
    ];
    const result = calcPlatformRanking(products, 3, testMapping);
    expect(result).toEqual([
      {
        rank: 1,
        productName: "벚꽃 끈갈피",
        category: "other",
        total: 3,
        naver: 3,
        coupang: 0,
        offline: 0,
      },
    ]);
  });

  test("calcPlatformRanking: 오프라인 상품은 offline 필드에 수량을 넣는다", () => {
    const result = calcPlatformRanking([makeProduct("A", 4, "offline")], 3);
    expect(result[0]).toMatchObject({
      naver: 0,
      coupang: 0,
      offline: 4,
      total: 4,
    });
  });

  test("calcOverallRanking: 합계가 같으면 네이버, 쿠팡, 오프라인 순으로 처음 나온 순서를 유지한다", () => {
    const result = calcOverallRanking(
      [makeProduct("N1", 3), makeProduct("N2", 3)],
      [makeProduct("C1", 3, "coupang")],
      [makeProduct("O1", 3, "offline"), makeProduct("N2", 1, "offline")],
      null,
      5,
    );
    expect(result.map((r) => [r.productName, r.total])).toEqual([
      ["N2", 4],
      ["N1", 3],
      ["C1", 3],
      ["O1", 3],
    ]);
  });

  test("calcOverallRanking: 카테고리는 처음 나온 상품의 값을 유지한다", () => {
    const result = calcOverallRanking(
      [makeProduct("A", 1, "naver", "other")],
      [makeProduct("A", 9, "coupang", "handmade")],
      [],
      null,
      5,
    );
    expect(result[0].category).toBe("other");
  });

  test("calcSponsorExcludedRanking: 협찬 수량이 판매량보다 많으면 0으로 보정되어 제외된다", () => {
    const sponsored: SponsoredItem[] = [
      { productName: "A", category: "handmade", quantity: 10 },
    ];
    const result = calcSponsorExcludedRanking(
      [makeProduct("A", 3), makeProduct("B", 1)],
      [],
      [],
      sponsored,
      null,
      5,
    );
    expect(result).toEqual([
      {
        rank: 1,
        productName: "B",
        category: "handmade",
        total: 1,
        naver: 1,
        coupang: 0,
        offline: 0,
      },
    ]);
  });

  test("calcSponsorExcludedRanking: 차감 뒤에도 플랫폼별 수량은 원래 값을 유지한다", () => {
    const sponsored: SponsoredItem[] = [
      { productName: "A", category: "handmade", quantity: 2 },
    ];
    const result = calcSponsorExcludedRanking(
      [makeProduct("A", 3)],
      [makeProduct("A", 4, "coupang")],
      [makeProduct("A", 1, "offline")],
      sponsored,
      null,
      5,
    );
    expect(result[0]).toMatchObject({
      total: 6,
      naver: 3,
      coupang: 4,
      offline: 1,
    });
  });

  test("calcSponsorExcludedRanking: 같은 상품이 협찬 목록에 두 번 있으면 마지막 수량만 차감한다", () => {
    const sponsored: SponsoredItem[] = [
      { productName: "A", category: "handmade", quantity: 5 },
      { productName: "A", category: "handmade", quantity: 1 },
    ];
    const result = calcSponsorExcludedRanking(
      [makeProduct("A", 10)],
      [],
      [],
      sponsored,
      null,
      5,
    );
    expect(result[0].total).toBe(9);
  });

  test("calcProductMatrix: 수량이 0인 판매 행은 카테고리를 덮어쓰지 않는다", () => {
    const result = calcProductMatrix(
      [makeProduct("A", 2, "naver", "handmade")],
      [makeProduct("A", 0, "coupang", "other")],
      [],
      null,
    );
    expect(result[0].category).toBe("handmade");
  });

  test("calcProductMatrix: 합계가 같으면 매핑 등록 순서 다음에 판매 등장 순서를 따른다", () => {
    const result = calcProductMatrix(
      [makeProduct("기타 상품", 0, "naver", "other")],
      [],
      [],
      testMapping,
    );
    expect(result.map((r) => r.productName)).toEqual([
      "벚꽃 끈갈피",
      "라벤더 끈갈피",
      "해바라기 끈갈피",
      "기타 상품",
    ]);
  });
});

// ─── rebuildDerivedFields ───────────────────────────────────────────────────

describe("rebuildDerivedFields", () => {
  const emptyFees = {
    commissionFee: 0,
    logisticsFee: 0,
    inboundShippingFee: 0,
    adFee: 0,
    settlementAmount: 0,
  };
  const names = ["A", "B", "C", "D", "E", "F", "G"];
  const naverProducts = names.map((n, i) => makeProduct(n, 20 - i, "naver"));
  const coupangProducts = names.map((n, i) =>
    makeProduct(n, 10 - i, "coupang"),
  );

  const naver: NaverData = {
    revenue: 1000,
    shippingCollected: 0,
    payerCount: 0,
    totalQuantity: 119,
    handmadeQuantity: 119,
    otherQuantity: 0,
    fees: emptyFees,
    shippingStats: { regularCount: 0, freeCount: 0, sellerCost: 0 },
    profit: { profit: 1000, materialCost: 100, netProfit: 900 },
    products: naverProducts,
  };
  const coupang: CoupangData = {
    revenue: 500,
    totalQuantity: 49,
    handmadeQuantity: 49,
    otherQuantity: 0,
    fees: emptyFees,
    profit: { profit: 500, materialCost: 50, netProfit: 450 },
    products: coupangProducts,
  };
  const makeVenue = (
    venueId: string,
    products: ProductSales[],
  ): OfflineData => ({
    venueId,
    venueName: venueId,
    revenue: 100,
    totalQuantity: products.reduce((s, p) => s + p.quantity, 0),
    handmadeQuantity: products.reduce((s, p) => s + p.quantity, 0),
    otherQuantity: 0,
    fees: emptyFees,
    profit: { profit: 100, materialCost: 10, netProfit: 90 },
    products,
  });
  const offline: OfflineData[] = [
    makeVenue("gosan", [
      makeProduct("A", 1, "offline"),
      makeProduct("B", 2, "offline"),
      makeProduct("C", 3, "offline"),
    ]),
    makeVenue("bookshop", [
      makeProduct("D", 4, "offline"),
      makeProduct("A", 5, "offline"),
    ]),
  ];
  const sponsorship: SponsorshipData = {
    items: [{ productName: "A", category: "handmade", quantity: 30 }],
    marketingCost: 40,
    totalQuantity: 30,
    handmadeQuantity: 30,
  };

  const result = rebuildDerivedFields(
    naver,
    coupang,
    offline,
    sponsorship,
    null,
  );

  test("플랫폼별 랭킹은 3개, 통합과 협찬 제외 랭킹은 5개까지 만든다", () => {
    expect(result.naverRanking.map((r) => r.productName)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(result.coupangRanking.map((r) => r.productName)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(result.overallRanking).toHaveLength(5);
    expect(result.sponsorExcludedRanking).toHaveLength(5);
  });

  test("오프라인 랭킹은 모든 입점처 상품을 합쳐서 계산한다", () => {
    expect(
      result.offlineRanking.map((r) => [r.productName, r.offline]),
    ).toEqual([
      ["A", 6],
      ["D", 4],
      ["C", 3],
    ]);
  });

  test("통합 랭킹은 세 플랫폼 수량을 더한 순서다", () => {
    expect(result.overallRanking.map((r) => [r.productName, r.total])).toEqual([
      ["A", 36],
      ["B", 30],
      ["C", 29],
      ["D", 28],
      ["E", 22],
    ]);
  });

  test("협찬 제외 랭킹은 협찬 수량을 뺀 순서다", () => {
    expect(
      result.sponsorExcludedRanking.map((r) => [r.productName, r.total]),
    ).toEqual([
      ["B", 30],
      ["C", 29],
      ["D", 28],
      ["E", 22],
      ["F", 20],
    ]);
  });

  test("요약은 협찬 비용을 순이익에서 빼고, 매트릭스는 전체 상품을 담는다", () => {
    expect(result.summary.totalRevenue).toBe(1700);
    expect(result.summary.marketingCost).toBe(40);
    expect(result.summary.totalNetProfit).toBe(1490); // 900+450+90+90-40
    expect(result.productMatrix).toHaveLength(7);
    expect(result.productMatrix[0]).toEqual({
      productName: "A",
      category: "handmade",
      naver: 20,
      coupang: 10,
      offline: 6,
      total: 36,
    });
  });
});
