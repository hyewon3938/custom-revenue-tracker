import { describe, test, expect } from "vitest";
import { aggregateProductSales, summarizeQuantities } from "./quantity";
import type { ProductSales } from "@/lib/types";

const product = (
  productName: string,
  category: ProductSales["category"],
  quantity: number,
): ProductSales => ({ productName, category, platform: "naver", quantity });

describe("aggregateProductSales", () => {
  test("빈 목록이면 빈 배열을 반환한다", () => {
    expect(aggregateProductSales([], "naver")).toEqual([]);
  });

  test("같은 상품명의 수량을 합친다", () => {
    const result = aggregateProductSales(
      [
        { productName: "벚꽃 끈갈피", quantity: 2 },
        { productName: "독서링 세트", quantity: 1 },
        { productName: "벚꽃 끈갈피", quantity: 3 },
      ],
      "naver",
    );

    expect(result).toEqual([
      {
        productName: "벚꽃 끈갈피",
        category: "handmade",
        platform: "naver",
        quantity: 5,
      },
      {
        productName: "독서링 세트",
        category: "other",
        platform: "naver",
        quantity: 1,
      },
    ]);
  });

  test("결과 순서는 상품명이 처음 나온 순서다", () => {
    const result = aggregateProductSales(
      [
        { productName: "다", quantity: 1 },
        { productName: "가", quantity: 1 },
        { productName: "나", quantity: 1 },
        { productName: "가", quantity: 1 },
        { productName: "다", quantity: 1 },
      ],
      "coupang",
    );

    expect(result.map((p) => p.productName)).toEqual(["다", "가", "나"]);
    expect(result.map((p) => p.quantity)).toEqual([2, 2, 1]);
  });

  test("넘겨받은 플랫폼을 모든 항목에 넣는다", () => {
    const result = aggregateProductSales(
      [
        { productName: "가", quantity: 1 },
        { productName: "나", quantity: 1 },
      ],
      "coupang",
    );

    expect(result.every((p) => p.platform === "coupang")).toBe(true);
  });

  test("입력 배열을 바꾸지 않는다", () => {
    const entries = [
      { productName: "가", quantity: 1 },
      { productName: "가", quantity: 2 },
    ];
    aggregateProductSales(entries, "naver");

    expect(entries).toEqual([
      { productName: "가", quantity: 1 },
      { productName: "가", quantity: 2 },
    ]);
  });
});

describe("summarizeQuantities", () => {
  test("빈 목록이면 모두 0이다", () => {
    expect(summarizeQuantities([])).toEqual({
      totalQuantity: 0,
      handmadeQuantity: 0,
      otherQuantity: 0,
    });
  });

  test("handmade와 그 외 수량을 나눠 합산한다", () => {
    const result = summarizeQuantities([
      product("벚꽃 끈갈피", "handmade", 3),
      product("독서링 세트", "other", 2),
      product("비즈 북마크", "handmade", 4),
    ]);

    expect(result).toEqual({
      totalQuantity: 9,
      handmadeQuantity: 7,
      otherQuantity: 2,
    });
  });

  test("handmade만 있으면 otherQuantity는 0이다", () => {
    expect(
      summarizeQuantities([product("벚꽃 끈갈피", "handmade", 5)]),
    ).toEqual({ totalQuantity: 5, handmadeQuantity: 5, otherQuantity: 0 });
  });
});
