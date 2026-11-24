import { describe, test, expect } from "vitest";
import { splitDateRange } from "./orders";

/**
 * splitDateRange는 "YYYY-MM-DD"를 UTC 자정으로 해석한 뒤 로컬 날짜로 다시 읽는다.
 * UTC보다 느린 타임존에서는 결과 날짜가 하루씩 당겨지므로,
 * 날짜 문자열을 그대로 비교하는 테스트는 UTC 이상(한국 포함) 타임존에서만 돌린다.
 */
const isBehindUtc = new Date().getTimezoneOffset() > 0;

const dates = (start: string, end: string) =>
  splitDateRange(start, end).map((c) => c.from);

describe("splitDateRange", () => {
  test("청크마다 from과 to가 같은 날이다", () => {
    const chunks = splitDateRange("2026-03-01", "2026-03-10");

    expect(chunks.every((c) => c.from === c.to)).toBe(true);
    expect(chunks.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.from))).toBe(true);
  });

  test("시작일과 종료일을 포함한 일수만큼 나눈다", () => {
    expect(splitDateRange("2026-03-01", "2026-03-01")).toHaveLength(1);
    expect(splitDateRange("2026-03-01", "2026-03-31")).toHaveLength(31);
    expect(splitDateRange("2026-04-01", "2026-04-30")).toHaveLength(30);
  });

  test("월 경계를 넘어가면 일수가 이어진다", () => {
    // 평년 2월: 27, 28, 3/1, 3/2
    expect(splitDateRange("2026-02-27", "2026-03-02")).toHaveLength(4);
    // 윤년 2월: 28, 29, 3/1
    expect(splitDateRange("2024-02-28", "2024-03-01")).toHaveLength(3);
    // 연말: 12/30, 12/31, 1/1, 1/2
    expect(splitDateRange("2025-12-30", "2026-01-02")).toHaveLength(4);
  });

  test("날짜가 겹치지 않는다", () => {
    const result = dates("2026-01-28", "2026-02-03");

    expect(new Set(result).size).toBe(result.length);
  });

  test("종료일이 시작일보다 앞이면 빈 배열이다", () => {
    expect(splitDateRange("2026-03-10", "2026-03-09")).toEqual([]);
  });

  test.skipIf(isBehindUtc)("하루 범위는 그 날짜 하나를 반환한다", () => {
    expect(splitDateRange("2026-03-05", "2026-03-05")).toEqual([
      { from: "2026-03-05", to: "2026-03-05" },
    ]);
  });

  test.skipIf(isBehindUtc)("월말에서 월초로 넘어간다", () => {
    expect(dates("2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });

  test.skipIf(isBehindUtc)("평년 2월 말에서 3월로 넘어간다", () => {
    expect(dates("2026-02-27", "2026-03-01")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
    ]);
  });

  test.skipIf(isBehindUtc)("윤년 2월 29일을 포함한다", () => {
    expect(dates("2024-02-28", "2024-03-01")).toEqual([
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
  });

  test.skipIf(isBehindUtc)("연말에서 연초로 넘어간다", () => {
    expect(dates("2025-12-31", "2026-01-01")).toEqual([
      "2025-12-31",
      "2026-01-01",
    ]);
  });

  test.skipIf(isBehindUtc)(
    "한 달 전체의 첫날과 마지막 날이 범위와 같다",
    () => {
      const result = dates("2026-11-01", "2026-11-30");

      expect(result[0]).toBe("2026-11-01");
      expect(result[result.length - 1]).toBe("2026-11-30");
    },
  );
});
