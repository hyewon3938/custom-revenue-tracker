import { describe, test, expect } from "vitest";
import { MAN_WON, formatManWon, formatKRWTooltip } from "./chart-config";

describe("formatManWon", () => {
  test("만 원 단위로 나눠 '만'을 붙인다", () => {
    expect(formatManWon(MAN_WON)).toBe("1만");
    expect(formatManWon(1_230_000)).toBe("123만");
  });

  test("0은 '0만'이다", () => {
    expect(formatManWon(0)).toBe("0만");
  });

  test("5천 원 경계에서 반올림한다", () => {
    expect(formatManWon(4_999)).toBe("0만");
    expect(formatManWon(5_000)).toBe("1만");
    expect(formatManWon(14_999)).toBe("1만");
    expect(formatManWon(15_000)).toBe("2만");
  });

  test("음수는 부호를 유지한다", () => {
    expect(formatManWon(-20_000)).toBe("-2만");
    expect(formatManWon(-15_001)).toBe("-2만");
  });

  test("음수 경계값은 0 쪽으로 반올림한다 (Math.round 규칙)", () => {
    expect(formatManWon(-15_000)).toBe("-1만");
    expect(formatManWon(-5_000)).toBe("0만");
    expect(formatManWon(-4_999)).toBe("0만");
  });
});

describe("formatKRWTooltip", () => {
  test("금액과 시리즈 이름을 순서대로 돌려준다", () => {
    expect(formatKRWTooltip(12_345, "네이버")).toEqual(["12,345 원", "네이버"]);
  });

  test("값과 이름이 없으면 0과 빈 문자열로 채운다", () => {
    expect(formatKRWTooltip(undefined, undefined)).toEqual(["0 원", ""]);
  });
});
