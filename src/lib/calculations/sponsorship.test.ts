import { describe, test, expect } from "vitest";
import { calcUnitSponsorshipCost, calcTotalSponsorshipCost } from "./sponsorship";

// 기본 상수 기준:
// MARKETING_LINK_FEE_RATE = 0.02857
// SPONSOR_SHIPPING_FEE    = 3000
// SPONSOR_SHIPPING_COST   = 3300
//
// 공식: round((단가 + 3000) * (0.1 + 0.02857) + 3300)

describe("calcUnitSponsorshipCost", () => {
  // (13900 + 3000) * 0.12857 + 3300 = 16900 * 0.12857 + 3300 = 2172.83 + 3300 = 5472.83 → 5473
  test("13,900원 제품의 1개당 비용을 계산한다", () => {
    expect(calcUnitSponsorshipCost(13900)).toBe(5473);
  });

  // (23000 + 3000) * 0.12857 + 3300 = 26000 * 0.12857 + 3300 = 3342.82 + 3300 = 6642.82 → 6643
  test("23,000원 제품의 1개당 비용을 계산한다", () => {
    expect(calcUnitSponsorshipCost(23000)).toBe(6643);
  });

  // (0 + 3000) * 0.12857 + 3300 = 385.71 + 3300 = 3685.71 → 3686
  test("단가 0원이면 배송비+수수료만 남는다", () => {
    expect(calcUnitSponsorshipCost(0)).toBe(3686);
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

  // 5473 * 8 = 43784
  test("단일 아이템의 총 비용을 계산한다", () => {
    const items = [
      { productName: "끈갈피A", category: "handmade" as const, quantity: 8, unitPrice: 13900 },
    ];
    expect(calcTotalSponsorshipCost(items)).toBe(5473 * 8);
  });

  // 6643 * 3 = 19929
  test("수량이 3개인 23,000원 제품의 총 비용은 약 19,929원이다", () => {
    const items = [
      { productName: "끈갈피A", category: "handmade" as const, quantity: 3, unitPrice: 23000 },
    ];
    expect(calcTotalSponsorshipCost(items)).toBe(6643 * 3);
  });

  // 6643*3 + 5473*2 = 19929 + 10946 = 30875
  test("여러 아이템의 총 비용을 합산한다", () => {
    const items = [
      { productName: "끈갈피A", category: "handmade" as const, quantity: 3, unitPrice: 23000 },
      { productName: "끈갈피B", category: "handmade" as const, quantity: 2, unitPrice: 13900 },
    ];
    expect(calcTotalSponsorshipCost(items)).toBe(6643 * 3 + 5473 * 2);
  });

  test("unitPrice가 없는 아이템이 있으면 null을 반환한다", () => {
    const items = [
      { productName: "끈갈피A", category: "handmade" as const, quantity: 3, unitPrice: 23000 },
      { productName: "끈갈피B", category: "handmade" as const, quantity: 2 },
    ];
    expect(calcTotalSponsorshipCost(items)).toBeNull();
  });

  test("unitPrice가 0인 아이템이 있으면 null을 반환한다", () => {
    const items = [
      { productName: "끈갈피A", category: "handmade" as const, quantity: 3, unitPrice: 0 },
    ];
    expect(calcTotalSponsorshipCost(items)).toBeNull();
  });

  test("수량이 1인 단일 아이템도 정확히 계산한다", () => {
    const items = [
      { productName: "끈갈피A", category: "handmade" as const, quantity: 1, unitPrice: 13900 },
    ];
    expect(calcTotalSponsorshipCost(items)).toBe(5473);
  });
});
