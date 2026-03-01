import { describe, test, expect } from "vitest";
import { deepMerge } from "./deep-merge";

// ─── 기본 동작 ──────────────────────────────────────────────────────────────

describe("deepMerge", () => {
  test("최상위 속성을 병합한다", () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = deepMerge(target, source);
    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  test("중첩 객체를 재귀적으로 병합한다", () => {
    const target = { outer: { a: 1, b: 2 } };
    const source = { outer: { b: 3 } };
    const result = deepMerge(target, source);
    expect(result).toEqual({ outer: { a: 1, b: 3 } });
  });

  test("3단계 이상 깊이의 중첩도 병합한다", () => {
    const target = { l1: { l2: { l3: { val: 1, keep: true } } } };
    const source = { l1: { l2: { l3: { val: 2 } } } };
    const result = deepMerge(target, source);
    expect(result).toEqual({ l1: { l2: { l3: { val: 2, keep: true } } } });
  });

  // ─── undefined 처리 ──────────────────────────────────────────────────────

  test("source에서 undefined 값은 무시한다", () => {
    const target = { a: 1, b: 2 };
    const source = { a: undefined, b: 3 };
    const result = deepMerge(target, source);
    expect(result.a).toBe(1);
    expect(result.b).toBe(3);
  });

  test("중첩 객체에서도 undefined를 무시한다", () => {
    const target = { nested: { x: 10, y: 20 } };
    const source = { nested: { x: undefined, y: 30 } };
    const result = deepMerge(target, source);
    expect(result.nested.x).toBe(10);
    expect(result.nested.y).toBe(30);
  });

  // ─── null 처리 ────────────────────────────────────────────────────────────

  test("source의 null 값은 target 값을 덮어쓴다", () => {
    const target = { a: 1, b: { x: 2 } };
    const source = { b: null };
    const result = deepMerge(target, source as Record<string, unknown>);
    expect(result.b).toBeNull();
  });

  test("target 값이 null이고 source가 객체면 source를 사용한다", () => {
    const target = { data: null as unknown };
    const source = { data: { x: 1 } };
    const result = deepMerge(target, source);
    expect(result.data).toEqual({ x: 1 });
  });

  // ─── 배열 처리 ────────────────────────────────────────────────────────────

  test("배열은 병합하지 않고 교체한다", () => {
    const target = { items: [1, 2, 3] };
    const source = { items: [4, 5] };
    const result = deepMerge(target, source);
    expect(result.items).toEqual([4, 5]);
  });

  test("빈 배열로 교체한다", () => {
    const target = { list: [1, 2, 3] };
    const source = { list: [] as number[] };
    const result = deepMerge(target, source);
    expect(result.list).toEqual([]);
  });

  test("객체 배열도 교체 방식으로 처리한다", () => {
    const target = { records: [{ id: 1, name: "a" }] };
    const source = { records: [{ id: 2, name: "b" }, { id: 3, name: "c" }] };
    const result = deepMerge(target, source);
    expect(result.records).toEqual([
      { id: 2, name: "b" },
      { id: 3, name: "c" },
    ]);
  });

  // ─── 불변성 ────────────────────────────────────────────────────────────────

  test("원본 target을 수정하지 않는다", () => {
    const target = { a: 1, nested: { b: 2 } };
    const original = JSON.parse(JSON.stringify(target));
    deepMerge(target, { a: 99, nested: { b: 99 } });
    expect(target).toEqual(original);
  });

  test("원본 source를 수정하지 않는다", () => {
    const target = { a: 1 };
    const source = { a: 2 };
    const original = { ...source };
    deepMerge(target, source);
    expect(source).toEqual(original);
  });

  // ─── 타입 혼합 ────────────────────────────────────────────────────────────

  test("source의 원시값이 target의 객체를 덮어쓴다", () => {
    const target = { val: { nested: true } as unknown };
    const source = { val: 42 };
    const result = deepMerge(target, source);
    expect(result.val).toBe(42);
  });

  test("source가 빈 객체면 target과 동일한 결과를 반환한다", () => {
    const target = { a: 1, b: { c: 2 } };
    const result = deepMerge(target, {});
    expect(result).toEqual(target);
  });

  // ─── 비즈니스 로직 시나리오 (PlatformFees 부분 업데이트) ─────────────────

  test("PlatformFees 구조에서 일부 필드만 업데이트한다", () => {
    const target = {
      fees: {
        commissionFee: 5000,
        logisticsFee: 3000,
        adFee: 1000,
        settlementAmount: 80000,
      },
    };
    const source = {
      fees: {
        adFee: 2000,
      },
    };
    const result = deepMerge(target, source);
    expect(result.fees).toEqual({
      commissionFee: 5000,
      logisticsFee: 3000,
      adFee: 2000,
      settlementAmount: 80000,
    });
  });

  test("복잡한 중첩 구조 (NaverData 시나리오) 부분 업데이트", () => {
    const target = {
      revenue: 100000,
      fees: {
        commissionFee: 5000,
        logisticsFee: 3000,
        adFee: 0,
        settlementAmount: 85000,
      },
      profit: {
        profit: 92000,
        materialCost: 14100,
        netProfit: 77900,
      },
    };
    const source = {
      revenue: 120000,
      fees: {
        commissionFee: 6000,
      },
    };
    const result = deepMerge(target, source);
    expect(result.revenue).toBe(120000);
    expect(result.fees.commissionFee).toBe(6000);
    expect(result.fees.logisticsFee).toBe(3000); // 유지
    expect(result.profit.profit).toBe(92000); // 유지 (source에 없음)
  });
});
