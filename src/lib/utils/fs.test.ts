import { describe, it, expect } from "vitest";
import { isEnoent } from "./fs";

describe("isEnoent", () => {
  it("code 가 ENOENT 인 에러만 true", () => {
    const enoent: NodeJS.ErrnoException = new Error("없음");
    enoent.code = "ENOENT";
    const eacces: NodeJS.ErrnoException = new Error("권한");
    eacces.code = "EACCES";

    expect(isEnoent(enoent)).toBe(true);
    expect(isEnoent(eacces)).toBe(false);
    expect(isEnoent(new Error("일반 에러"))).toBe(false);
    expect(isEnoent(new SyntaxError("파싱 실패"))).toBe(false);
  });

  it("Error 가 아닌 객체·문자열도 code 로만 판단한다", () => {
    expect(isEnoent({ code: "ENOENT" })).toBe(true);
    expect(isEnoent({})).toBe(false);
    expect(isEnoent("ENOENT")).toBe(false);
  });
});
