import { describe, test, expect } from "vitest";
import type { ProductMatrixRow, ProductSales } from "@/lib/types";
import {
  isCoupangManual,
  buildCoupangEditList,
  toProductSales,
  parseQty,
} from "./platform-edit";

const row = (
  productName: string,
  category: ProductMatrixRow["category"] = "handmade",
): ProductMatrixRow => ({
  productName,
  category,
  naver: 1,
  coupang: 2,
  offline: 3,
  total: 6,
});

const sale = (
  productName: string,
  quantity: number,
  category: ProductSales["category"] = "handmade",
): ProductSales => ({ productName, category, platform: "coupang", quantity });

describe("isCoupangManual", () => {
  test("2025년 3월 이전은 수기 모드다", () => {
    expect(isCoupangManual(2025, 2)).toBe(true);
    expect(isCoupangManual(2025, 1)).toBe(true);
    expect(isCoupangManual(2024, 12)).toBe(true);
    expect(isCoupangManual(2023, 6)).toBe(true);
  });

  test("2025년 3월부터는 수기 모드가 아니다", () => {
    expect(isCoupangManual(2025, 3)).toBe(false);
    expect(isCoupangManual(2025, 12)).toBe(false);
    expect(isCoupangManual(2026, 1)).toBe(false);
  });
});

describe("buildCoupangEditList", () => {
  test("수기 모드가 아니면 빈 배열을 돌려준다", () => {
    expect(buildCoupangEditList(false, [row("가")], [sale("나", 2)])).toEqual(
      [],
    );
  });

  test("매트릭스에 없는 쿠팡 상품을 매트릭스 뒤에 덧붙인다", () => {
    const matrix = [row("나"), row("가")];
    const products = [sale("다", 4, "other"), sale("가", 9), sale("라", 0)];

    expect(buildCoupangEditList(true, matrix, products)).toEqual([
      row("나"),
      row("가"),
      {
        productName: "다",
        category: "other",
        naver: 0,
        coupang: 4,
        offline: 0,
        total: 4,
      },
      {
        productName: "라",
        category: "handmade",
        naver: 0,
        coupang: 0,
        offline: 0,
        total: 0,
      },
    ]);
  });

  test("매트릭스 행은 같은 객체를 그대로 쓰고 원본 배열을 바꾸지 않는다", () => {
    const matrix = [row("가")];
    const result = buildCoupangEditList(true, matrix, []);

    expect(result).not.toBe(matrix);
    expect(result[0]).toBe(matrix[0]);
    expect(matrix).toHaveLength(1);
  });

  test("매트릭스에 없는 같은 이름이 여러 번 나오면 모두 덧붙인다", () => {
    const result = buildCoupangEditList(
      true,
      [],
      [sale("가", 1), sale("가", 2)],
    );
    expect(result.map((r) => r.coupang)).toEqual([1, 2]);
  });
});

describe("toProductSales", () => {
  test("수량이 0보다 큰 행만 목록 순서대로 남긴다", () => {
    const editList = [row("다", "other"), row("가"), row("나"), row("라")];
    const quantities = { 가: 3, 나: 0, 다: 1, 없는상품: 7 };

    expect(toProductSales(editList, quantities, "coupang")).toEqual([
      {
        productName: "다",
        category: "other",
        platform: "coupang",
        quantity: 1,
      },
      {
        productName: "가",
        category: "handmade",
        platform: "coupang",
        quantity: 3,
      },
    ]);
  });

  test("넘긴 플랫폼을 그대로 붙이고 필드는 네 개뿐이다", () => {
    const result = toProductSales([row("가")], { 가: 2 }, "offline");

    expect(result).toEqual([
      {
        productName: "가",
        category: "handmade",
        platform: "offline",
        quantity: 2,
      },
    ]);
    expect(Object.keys(result[0])).toEqual([
      "productName",
      "category",
      "platform",
      "quantity",
    ]);
  });

  test("소수 수량은 그대로 두고 음수와 NaN 은 뺀다", () => {
    const editList = [row("가"), row("나"), row("다")];
    const quantities = { 가: 1.5, 나: -2, 다: NaN };

    expect(toProductSales(editList, quantities, "offline")).toEqual([
      {
        productName: "가",
        category: "handmade",
        platform: "offline",
        quantity: 1.5,
      },
    ]);
  });

  test("빈 목록이면 빈 배열이다", () => {
    expect(toProductSales([], { 가: 1 }, "coupang")).toEqual([]);
  });
});

describe("parseQty", () => {
  test("정수 문자열은 그 수가 된다", () => {
    expect(parseQty("7")).toBe(7);
    expect(parseQty("0")).toBe(0);
  });

  test("빈 문자열과 공백은 0 이다", () => {
    expect(parseQty("")).toBe(0);
    expect(parseQty("  ")).toBe(0);
  });

  test("음수는 0 으로 올린다", () => {
    expect(parseQty("-3")).toBe(0);
  });

  test("소수는 반올림하지 않는다", () => {
    expect(parseQty("1.5")).toBe(1.5);
  });

  test("숫자가 아닌 입력은 NaN 이다", () => {
    expect(parseQty("abc")).toBeNaN();
    expect(parseQty("12개")).toBeNaN();
  });
});
