import { describe, test, expect } from "vitest";
import { TYPE_CONFIG, TYPE_ORDER, formatGeneratedAt } from "./insights-config";

/** 로컬 시각으로 만든 ISO 문자열 (테스트가 시간대에 의존하지 않도록) */
const localISO = (month: number, day: number, hour: number, minute: number) =>
  new Date(2026, month - 1, day, hour, minute).toISOString();

describe("formatGeneratedAt", () => {
  test("월·일·시:분 뒤에 '생성'을 붙인다", () => {
    expect(formatGeneratedAt(localISO(3, 1, 15, 30))).toBe("3월 1일 15:30 생성");
  });

  test("분은 두 자리로 채우고 시는 채우지 않는다", () => {
    expect(formatGeneratedAt(localISO(12, 31, 9, 5))).toBe("12월 31일 9:05 생성");
  });

  test("자정은 0시로 표기한다", () => {
    expect(formatGeneratedAt(localISO(1, 1, 0, 0))).toBe("1월 1일 0:00 생성");
  });
});

describe("TYPE_CONFIG", () => {
  test("표시 순서의 모든 타입에 설정이 있다", () => {
    expect(TYPE_ORDER).toEqual(["negative", "action", "neutral", "positive"]);
    for (const type of TYPE_ORDER) {
      expect(TYPE_CONFIG[type].label).not.toBe("");
    }
  });
});
