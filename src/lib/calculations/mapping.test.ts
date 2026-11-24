import { describe, it, expect } from "vitest";
import { buildNewProductMappings, mergeProductMappings } from "./mapping";
import type { ProductMapping, ProductSales } from "@/lib/types";

function sales(
  platform: ProductSales["platform"],
  ...names: string[]
): ProductSales[] {
  return names.map((productName) => ({
    productName,
    category: "handmade",
    platform,
    quantity: 1,
  }));
}

describe("buildNewProductMappings", () => {
  it("상품이 없거나 모두 매핑돼 있으면 빈 배열", () => {
    expect(buildNewProductMappings([], [], [])).toEqual([]);

    const existing: ProductMapping[] = [
      { canonical: "달빛", naver: "달빛 끈갈피", coupang: "달빛 북마크" },
    ];
    expect(
      buildNewProductMappings(
        existing,
        sales("naver", "달빛 끈갈피"),
        sales("coupang", "달빛 북마크"),
      ),
    ).toEqual([]);
  });

  it("유사한 네이버·쿠팡 신규 상품을 묶고 canonical 은 쿠팡명을 정제해 쓴다", () => {
    expect(
      buildNewProductMappings(
        [],
        sales("naver", "[리커밋] 달빛 은하 끈갈피"),
        sales("coupang", "[특가] 달빛 은하 북마크"),
      ),
    ).toEqual([
      {
        canonical: "달빛 은하 북마크",
        naver: "[리커밋] 달빛 은하 끈갈피",
        coupang: "[특가] 달빛 은하 북마크",
      },
    ]);
  });

  it("짝이 없는 상품은 단독 항목: 네이버 먼저, 남은 쿠팡이 뒤에 온다", () => {
    expect(
      buildNewProductMappings(
        [],
        sales("naver", "[리커밋] 노을 끈갈피"),
        sales("coupang", "바다 북마크"),
      ),
    ).toEqual([
      { canonical: "노을 끈갈피", naver: "[리커밋] 노을 끈갈피" },
      { canonical: "바다 북마크", coupang: "바다 북마크" },
    ]);
  });

  it("같은 상품명이 여러 번 나와도 한 번만 만든다", () => {
    expect(
      buildNewProductMappings(
        [],
        sales("naver", "노을 끈갈피", "노을 끈갈피"),
        sales("coupang", "바다 북마크", "바다 북마크"),
      ),
    ).toHaveLength(2);
  });

  it("이미 매핑된 쿠팡 상품은 신규 네이버 상품의 짝 후보에서 빠진다", () => {
    const existing: ProductMapping[] = [
      { canonical: "달빛 은하", coupang: "달빛 은하 북마크" },
    ];
    expect(
      buildNewProductMappings(
        existing,
        sales("naver", "달빛 은하 끈갈피"),
        sales("coupang", "달빛 은하 북마크"),
      ),
    ).toEqual([{ canonical: "달빛 은하 끈갈피", naver: "달빛 은하 끈갈피" }]);
  });

  it("쿠팡 상품 하나는 먼저 나온 네이버 상품 하나에만 묶인다", () => {
    expect(
      buildNewProductMappings(
        [],
        sales("naver", "달빛 은하 끈갈피", "달빛 은하 책갈피"),
        sales("coupang", "달빛 은하 북마크"),
      ),
    ).toEqual([
      {
        canonical: "달빛 은하 북마크",
        naver: "달빛 은하 끈갈피",
        coupang: "달빛 은하 북마크",
      },
      { canonical: "달빛 은하 책갈피", naver: "달빛 은하 책갈피" },
    ]);
  });

  it("유사도가 같으면 먼저 나온 쿠팡 상품을 고른다", () => {
    const result = buildNewProductMappings(
      [],
      sales("naver", "달빛 은하 끈갈피"),
      sales("coupang", "달빛 은하 북마크", "달빛 은하 북클립"),
    );
    expect(result).toEqual([
      {
        canonical: "달빛 은하 북마크",
        naver: "달빛 은하 끈갈피",
        coupang: "달빛 은하 북마크",
      },
      { canonical: "달빛 은하 북클립", coupang: "달빛 은하 북클립" },
    ]);
  });

  it("유사도가 더 높은 쿠팡 상품이 뒤에 있으면 그쪽을 고른다", () => {
    const result = buildNewProductMappings(
      [],
      sales("naver", "달빛 은하 끈갈피"),
      sales("coupang", "달빛 노을 바다 북마크", "달빛 은하 북마크"),
    );
    expect(result[0]).toEqual({
      canonical: "달빛 은하 북마크",
      naver: "달빛 은하 끈갈피",
      coupang: "달빛 은하 북마크",
    });
    expect(result[1]).toEqual({
      canonical: "달빛 노을 바다 북마크",
      coupang: "달빛 노을 바다 북마크",
    });
  });

  it("유사도가 임계값보다 낮으면 묶지 않는다", () => {
    // 키워드 1개 겹침 / 합집합 7개 = 약 0.14
    const result = buildNewProductMappings(
      [],
      sales("naver", "달빛 은하 노을 바람 끈갈피"),
      sales("coupang", "달빛 바다 구름 숲 북마크"),
    );
    expect(result).toEqual([
      {
        canonical: "달빛 은하 노을 바람 끈갈피",
        naver: "달빛 은하 노을 바람 끈갈피",
      },
      {
        canonical: "달빛 바다 구름 숲 북마크",
        coupang: "달빛 바다 구름 숲 북마크",
      },
    ]);
  });

  it("입력 배열을 변경하지 않는다", () => {
    const existing: ProductMapping[] = [{ canonical: "하늘", naver: "하늘" }];
    const naverProducts = sales("naver", "노을 끈갈피");
    const snapshot = JSON.stringify({ existing, naverProducts });
    buildNewProductMappings(existing, naverProducts, []);
    expect(JSON.stringify({ existing, naverProducts })).toBe(snapshot);
  });
});

describe("mergeProductMappings", () => {
  it("기존 + 신규를 canonical 가나다순으로 정렬한 새 배열을 만든다", () => {
    const existing: ProductMapping[] = [
      { canonical: "하늘", naver: "하늘 끈갈피" },
      { canonical: "나비", coupang: "나비 북마크" },
    ];
    const added: ProductMapping[] = [
      { canonical: "바다", coupang: "바다 북마크" },
      { canonical: "가을", naver: "가을 끈갈피" },
    ];
    const result = mergeProductMappings(existing, added);

    expect(result.map((m) => m.canonical)).toEqual([
      "가을",
      "나비",
      "바다",
      "하늘",
    ]);
    expect(existing.map((m) => m.canonical)).toEqual(["하늘", "나비"]);
    expect(added.map((m) => m.canonical)).toEqual(["바다", "가을"]);
  });

  it("canonical 이 같으면 기존 항목이 신규보다, 먼저 나온 항목이 앞에 온다", () => {
    const result = mergeProductMappings(
      [{ canonical: "달빛", naver: "기존" }],
      [
        { canonical: "달빛", naver: "신규1" },
        { canonical: "달빛", naver: "신규2" },
      ],
    );
    expect(result.map((m) => m.naver)).toEqual(["기존", "신규1", "신규2"]);
  });
});
