import { describe, test, expect } from "vitest";
import { formatKRW, getPrevMonth, pad } from "./format";

describe("pad", () => {
  test("한 자리 숫자를 두 자리로 패딩한다", () => {
    expect(pad(1)).toBe("01");
    expect(pad(9)).toBe("09");
  });

  test("두 자리 숫자는 그대로 반환한다", () => {
    expect(pad(10)).toBe("10");
    expect(pad(12)).toBe("12");
  });
});

describe("formatKRW", () => {
  test("천 단위 콤마와 '원' 단위를 붙인다", () => {
    expect(formatKRW(1000)).toBe("1,000 원");
    expect(formatKRW(1234567)).toBe("1,234,567 원");
  });

  test("0은 '0 원'으로 표시한다", () => {
    expect(formatKRW(0)).toBe("0 원");
  });

  test("음수도 포맷한다", () => {
    expect(formatKRW(-5000)).toBe("-5,000 원");
  });
});

describe("getPrevMonth", () => {
  test("일반적인 경우 전달을 반환한다", () => {
    expect(getPrevMonth(2026, 3)).toEqual({ year: 2026, month: 2 });
    expect(getPrevMonth(2026, 12)).toEqual({ year: 2026, month: 11 });
  });

  test("1월이면 전년 12월을 반환한다", () => {
    expect(getPrevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
});
