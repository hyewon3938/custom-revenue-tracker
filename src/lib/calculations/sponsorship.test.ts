import { describe, test, expect } from "vitest";
import {
  calcUnitSponsorshipCost,
  calcTotalSponsorshipCost,
} from "./sponsorship";

// 기본 상수 기준:
// SPONSOR_SHIPPING_FEE = 3000
//
// 공식: round((단가 + 3000) * 1.1)

describe("calcUnitSponsorshipCost", () => {
  // (13900 + 3000) * 1.1 = 16900 * 1.1 = 18590
  test("13,900원 제품의 1개당 비용을 계산한다", () => {
    expect(calcUnitSponsorshipCost(13900)).toBe(18590);
  });

  // (23000 + 3000) * 1.1 = 26000 * 1.1 = 28600
  test("23,000원 제품의 1개당 비용을 계산한다", () => {
    expect(calcUnitSponsorshipCost(23000)).toBe(28600);
  });

  // (0 + 3000) * 1.1 = 3300
  test("단가 0원이면 배송비분만 남는다", () => {
    expect(calcUnitSponsorshipCost(0)).toBe(3300);
  });

  test("결과는 원 단위 정수다", () => {
    expect(Number.isInteger(calcUnitSponsorshipCost(13900))).toBe(true);
    expect(Number.isInteger(calcUnitSponsorshipCost(23000))).toBe(true);
  });
});

describe("calcTotalSponsorshipCost", () => {
  test("빈 목록이면 0을 반환한다", () => {
    expect(calcTotalSponsorshipCost([])).toBe(0);
  });

  // 18590 * 8 = 148720
  test("단일 아이템의 총 비용을 계산한다", () => {
    const items = [
      {
        productName: "끈갈피A",
        category: "handmade" as const,
        quantity: 8,
        unitPrice: 13900,
      },
    ];
    expect(calcTotalSponsorshipCost(items)).toBe(18590 * 8);
  });

  // 28600 * 3 = 85800
  test("수량이 3개인 23,000원 제품의 총 비용은 85,800원이다", () => {
    const items = [
      {
        productName: "끈갈피A",
        category: "handmade" as const,
        quantity: 3,
        unitPrice: 23000,
      },
    ];
    expect(calcTotalSponsorshipCost(items)).toBe(28600 * 3);
  });

  // 28600*3 + 18590*2 = 85800 + 37180 = 122980
  test("여러 아이템의 총 비용을 합산한다", () => {
    const items = [
      {
        productName: "끈갈피A",
        category: "handmade" as const,
        quantity: 3,
        unitPrice: 23000,
      },
      {
        productName: "끈갈피B",
        category: "handmade" as const,
        quantity: 2,
        unitPrice: 13900,
      },
    ];
    expect(calcTotalSponsorshipCost(items)).toBe(28600 * 3 + 18590 * 2);
  });

  test("unitPrice가 없는 아이템이 있으면 null을 반환한다", () => {
    const items = [
      {
        productName: "끈갈피A",
        category: "handmade" as const,
        quantity: 3,
        unitPrice: 23000,
      },
      { productName: "끈갈피B", category: "handmade" as const, quantity: 2 },
    ];
    expect(calcTotalSponsorshipCost(items)).toBeNull();
  });

  test("unitPrice가 0인 아이템이 있으면 null을 반환한다", () => {
    const items = [
      {
        productName: "끈갈피A",
        category: "handmade" as const,
        quantity: 3,
        unitPrice: 0,
      },
    ];
    expect(calcTotalSponsorshipCost(items)).toBeNull();
  });

  test("수량이 1인 단일 아이템도 정확히 계산한다", () => {
    const items = [
      {
        productName: "끈갈피A",
        category: "handmade" as const,
        quantity: 1,
        unitPrice: 13900,
      },
    ];
    expect(calcTotalSponsorshipCost(items)).toBe(18590);
  });
});
