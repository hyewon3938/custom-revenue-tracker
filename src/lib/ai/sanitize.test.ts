import { describe, test, expect } from "vitest";
import { sanitizeText } from "./insights";

describe("sanitizeText", () => {
  test("3글자 한자 패턴을 한글로 치환한다", () => {
    expect(sanitizeText("相対的으로 안정")).toBe("상대적으로 안정");
    expect(sanitizeText("效果的인 전략")).toBe("효과적인 전략");
    expect(sanitizeText("戰略的 판단")).toBe("전략적 판단");
  });

  test("2글자 한자 패턴을 한글로 치환한다", () => {
    expect(sanitizeText("前月 대비 增加")).toBe("전월 대비 증가");
    expect(sanitizeText("分析 결과 效果 있음")).toBe("분석 결과 효과 있음");
    expect(sanitizeText("收益이 減少했다")).toBe("수익이 감소했다");
  });

  test("3글자 패턴이 2글자보다 우선 매칭된다", () => {
    // "相対的" → "상대적" (3글자 매칭), "相対" + "的" 따로 매칭 아님
    expect(sanitizeText("相対的")).toBe("상대적");
    expect(sanitizeText("安定的인 수익")).toBe("안정적인 수익");
  });

  test("매핑에 없는 한자는 제거한다", () => {
    expect(sanitizeText("未知의 한자")).toBe("의 한자");
  });

  test("한글만 있는 문자열은 그대로 반환한다", () => {
    expect(sanitizeText("매출이 증가했습니다")).toBe("매출이 증가했습니다");
    expect(sanitizeText("")).toBe("");
  });

  test("영문·숫자·기호는 보존한다", () => {
    expect(sanitizeText("ROAS 3.5 달성")).toBe("ROAS 3.5 달성");
    expect(sanitizeText("**매출 增加** 100%")).toBe("**매출 증가** 100%");
  });

  test("한 문장에 여러 한자 패턴이 섞여 있어도 모두 처리한다", () => {
    expect(sanitizeText("前月 比較 分析 결과 成長")).toBe(
      "전월 비교 분석 결과 성장"
    );
  });
});
