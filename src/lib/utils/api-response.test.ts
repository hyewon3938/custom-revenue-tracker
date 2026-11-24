import { describe, it, expect } from "vitest";
import { errorJson, serverErrorJson, parseYearMonth } from "./api-response";

describe("errorJson", () => {
  it("error 필드와 상태코드를 담는다", async () => {
    const res = errorJson("잘못된 요청", 400);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "잘못된 요청" });
  });
});

describe("serverErrorJson", () => {
  it("Error면 그 메시지로 500을 돌려준다", async () => {
    const res = serverErrorJson(new Error("디스크 오류"), "조회 실패");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "디스크 오류" });
  });

  it("Error가 아니면 fallback 문구를 쓴다", async () => {
    const res = serverErrorJson("문자열", "조회 실패");
    expect(await res.json()).toEqual({ error: "조회 실패" });
  });
});

describe("parseYearMonth", () => {
  it("숫자 문자열을 정수로 바꾼다", () => {
    expect(parseYearMonth("2026", "2")).toEqual({ year: 2026, month: 2 });
  });

  it("parseInt와 같이 앞부분 숫자만 읽는다", () => {
    expect(parseYearMonth("2026abc", "02")).toEqual({ year: 2026, month: 2 });
  });

  it("하나라도 숫자가 아니면 null", () => {
    expect(parseYearMonth("abc", "2")).toBeNull();
    expect(parseYearMonth("2026", "x")).toBeNull();
  });
});
