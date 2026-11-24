import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { getDateRange } from "./date-range";

describe("getDateRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 로컬 시각 기준으로 오늘을 고정 (타임존과 무관하게 같은 로컬 날짜)
  const setToday = (year: number, month: number, day: number) =>
    vi.setSystemTime(new Date(year, month - 1, day, 12, 0, 0));

  test("과거 월이면 1일부터 말일까지다", () => {
    setToday(2026, 11, 24);

    expect(getDateRange(2026, 10)).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(getDateRange(2026, 9)).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });

  test("2월 말일은 윤년 여부를 따른다", () => {
    setToday(2026, 11, 24);

    expect(getDateRange(2026, 2).end).toBe("2026-02-28");
    expect(getDateRange(2024, 2).end).toBe("2024-02-29");
  });

  test("이번 달이면 1일부터 어제까지다", () => {
    setToday(2026, 11, 24);

    expect(getDateRange(2026, 11)).toEqual({
      start: "2026-11-01",
      end: "2026-11-23",
    });
  });

  test("이번 달 1일이면 종료일은 1일이다", () => {
    setToday(2026, 11, 1);

    expect(getDateRange(2026, 11)).toEqual({
      start: "2026-11-01",
      end: "2026-11-01",
    });
  });

  test("이번 달 2일이면 종료일은 1일이다", () => {
    setToday(2026, 11, 2);

    expect(getDateRange(2026, 11).end).toBe("2026-11-01");
  });

  test("한 자리 월과 일은 0을 채운다", () => {
    setToday(2026, 3, 6);

    expect(getDateRange(2026, 3)).toEqual({
      start: "2026-03-01",
      end: "2026-03-05",
    });
  });

  test("같은 월이라도 연도가 다르면 과거 월로 본다", () => {
    setToday(2026, 11, 24);

    expect(getDateRange(2025, 11).end).toBe("2025-11-30");
  });

  test("미래 월이면 말일까지다", () => {
    setToday(2026, 11, 24);

    expect(getDateRange(2026, 12).end).toBe("2026-12-31");
  });
});
