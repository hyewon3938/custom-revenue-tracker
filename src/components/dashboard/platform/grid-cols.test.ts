import { describe, test, expect } from "vitest";
import { getGridCols } from "./grid-cols";

describe("getGridCols", () => {
  test("카드 2개 이하는 2등분이다", () => {
    expect(getGridCols(0)).toBe("grid-cols-1 md:grid-cols-2");
    expect(getGridCols(2)).toBe("grid-cols-1 md:grid-cols-2");
  });

  test("카드 3개는 3등분이다", () => {
    expect(getGridCols(3)).toBe("grid-cols-1 md:grid-cols-3");
  });

  test("카드 4개는 넓은 화면에서 4등분이다", () => {
    expect(getGridCols(4)).toBe("grid-cols-1 md:grid-cols-2 xl:grid-cols-4");
  });

  test("카드 5개 이상은 한 줄 3개씩이다", () => {
    expect(getGridCols(5)).toBe("grid-cols-1 md:grid-cols-2 lg:grid-cols-3");
    expect(getGridCols(9)).toBe("grid-cols-1 md:grid-cols-2 lg:grid-cols-3");
  });
});
