import { describe, test, expect } from "vitest";
import {
  detectCategory,
  reclassifyAndSummarize,
  extractKeywords,
  jaccardSimilarity,
  cleanProductName,
  toCanonical,
  STOP_WORDS,
} from "./product";
import type { ProductSales, ProductMappingConfig } from "@/lib/types";

// ─── detectCategory ────────────────────────────────────────────────────────

describe("detectCategory", () => {
  test("'끈갈피'가 포함되면 handmade를 반환한다", () => {
    expect(detectCategory("벚꽃 끈갈피")).toBe("handmade");
    expect(detectCategory("[리커밋] 벚꽃 끈갈피 세트")).toBe("handmade");
  });

  test("'북마크'가 포함되면 handmade를 반환한다", () => {
    expect(detectCategory("비즈 북마크 라벤더")).toBe("handmade");
  });

  test("'독서링'이 포함되면 other를 반환한다", () => {
    expect(detectCategory("독서링 세트")).toBe("other");
  });

  test("'독서링'은 끈갈피/북마크보다 우선한다", () => {
    // 실제로 이런 상품명은 없겠지만 분기 우선순위 확인
    expect(detectCategory("독서링 끈갈피")).toBe("other");
  });

  test("해당 키워드가 없으면 other를 반환한다", () => {
    expect(detectCategory("노트패드")).toBe("other");
    expect(detectCategory("펜슬 케이스")).toBe("other");
  });

  test("빈 문자열은 other를 반환한다", () => {
    expect(detectCategory("")).toBe("other");
  });
});

// ─── reclassifyAndSummarize ────────────────────────────────────────────────

describe("reclassifyAndSummarize", () => {
  test("상품 카테고리를 재분류하고 수량을 집계한다", () => {
    const products: ProductSales[] = [
      { productName: "벚꽃 끈갈피", category: "other", platform: "naver", quantity: 5 },
      { productName: "독서링", category: "handmade", platform: "naver", quantity: 3 },
      { productName: "라벤더 북마크", category: "other", platform: "naver", quantity: 2 },
    ];
    const result = reclassifyAndSummarize(products);
    expect(result.totalQuantity).toBe(10);
    expect(result.handmadeQuantity).toBe(7); // 벚꽃 끈갈피(5) + 라벤더 북마크(2)
    expect(result.otherQuantity).toBe(3); // 독서링(3)
  });

  test("카테고리가 detectCategory 기준으로 재분류된다", () => {
    const products: ProductSales[] = [
      { productName: "벚꽃 끈갈피", category: "other", platform: "naver", quantity: 1 },
    ];
    const result = reclassifyAndSummarize(products);
    expect(result.products[0].category).toBe("handmade");
  });

  test("빈 배열은 모든 수량이 0이다", () => {
    const result = reclassifyAndSummarize([]);
    expect(result.totalQuantity).toBe(0);
    expect(result.handmadeQuantity).toBe(0);
    expect(result.otherQuantity).toBe(0);
    expect(result.products).toEqual([]);
  });

  test("원본 배열을 수정하지 않는다 (불변성)", () => {
    const products: ProductSales[] = [
      { productName: "벚꽃 끈갈피", category: "other", platform: "naver", quantity: 3 },
    ];
    const originalCategory = products[0].category;
    reclassifyAndSummarize(products);
    expect(products[0].category).toBe(originalCategory);
  });
});

// ─── extractKeywords ────────────────────────────────────────────────────────

describe("extractKeywords", () => {
  test("대괄호 접두어를 제거한다", () => {
    const kw = extractKeywords("[리커밋] 벚꽃 라벤더");
    expect(kw.has("리커밋")).toBe(false);
    expect(kw.has("벚꽃")).toBe(true);
    expect(kw.has("라벤더")).toBe(true);
  });

  test("특수문자를 제거한다", () => {
    const kw = extractKeywords("벚꽃-라벤더·해바라기");
    // '-', '·' 등은 공백으로 변환 후 분리
    expect(kw.has("벚꽃")).toBe(true);
    expect(kw.has("라벤더")).toBe(true);
    expect(kw.has("해바라기")).toBe(true);
  });

  test("불용어를 제거한다", () => {
    const kw = extractKeywords("끈갈피 벚꽃 선물 독서모임");
    expect(kw.has("끈갈피")).toBe(false);
    expect(kw.has("선물")).toBe(false);
    expect(kw.has("독서모임")).toBe(false);
    expect(kw.has("벚꽃")).toBe(true);
  });

  test("영문을 소문자로 변환한다", () => {
    const kw = extractKeywords("Cherry Blossom");
    expect(kw.has("cherry")).toBe(true);
    expect(kw.has("blossom")).toBe(true);
  });

  test("빈 문자열은 빈 Set을 반환한다", () => {
    const kw = extractKeywords("");
    expect(kw.size).toBe(0);
  });

  test("불용어만 있는 문자열은 빈 Set을 반환한다", () => {
    const kw = extractKeywords("끈갈피 비즈 북마크");
    expect(kw.size).toBe(0);
  });
});

// ─── jaccardSimilarity ──────────────────────────────────────────────────────

describe("jaccardSimilarity", () => {
  test("동일한 집합은 1을 반환한다", () => {
    const a = new Set(["벚꽃", "라벤더"]);
    const b = new Set(["벚꽃", "라벤더"]);
    expect(jaccardSimilarity(a, b)).toBe(1);
  });

  test("완전히 다른 집합은 0을 반환한다", () => {
    const a = new Set(["벚꽃"]);
    const b = new Set(["해바라기"]);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  test("부분 겹침은 intersection/union 비율을 반환한다", () => {
    const a = new Set(["벚꽃", "라벤더"]);
    const b = new Set(["벚꽃", "해바라기"]);
    // intersection: {벚꽃} = 1, union: {벚꽃, 라벤더, 해바라기} = 3
    expect(jaccardSimilarity(a, b)).toBeCloseTo(1 / 3);
  });

  test("두 집합 모두 비어있으면 1을 반환한다", () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
  });

  test("한쪽만 비어있으면 0을 반환한다", () => {
    const a = new Set(["벚꽃"]);
    expect(jaccardSimilarity(a, new Set())).toBe(0);
    expect(jaccardSimilarity(new Set(), a)).toBe(0);
  });

  test("포함 관계: 부분집합/상위집합", () => {
    const a = new Set(["벚꽃"]);
    const b = new Set(["벚꽃", "라벤더", "해바라기"]);
    // intersection: 1, union: 3
    expect(jaccardSimilarity(a, b)).toBeCloseTo(1 / 3);
  });
});

// ─── cleanProductName ───────────────────────────────────────────────────────

describe("cleanProductName", () => {
  test("대괄호 접두어를 제거한다", () => {
    expect(cleanProductName("[리커밋] 벚꽃 끈갈피")).toBe("벚꽃 끈갈피");
  });

  test("여러 대괄호를 모두 제거한다", () => {
    expect(cleanProductName("[할인] [리커밋] 벚꽃 끈갈피")).toBe("벚꽃 끈갈피");
  });

  test("대괄호가 없으면 그대로 반환한다", () => {
    expect(cleanProductName("벚꽃 끈갈피")).toBe("벚꽃 끈갈피");
  });

  test("앞뒤 공백을 정리한다", () => {
    expect(cleanProductName("  벚꽃 끈갈피  ")).toBe("벚꽃 끈갈피");
  });
});

// ─── toCanonical ────────────────────────────────────────────────────────────

describe("toCanonical", () => {
  const mapping: ProductMappingConfig = {
    mappings: [
      { canonical: "벚꽃 끈갈피", naver: "[리커밋] 벚꽃 끈갈피", coupang: "벚꽃 비즈 북마크" },
      { canonical: "라벤더 끈갈피", naver: "[리커밋] 라벤더 끈갈피", coupang: "라벤더 비즈 북마크" },
    ],
    generatedAt: "2026-01-01T00:00:00Z",
    confirmedByUser: true,
  };

  test("매핑이 null이면 원본 이름을 반환한다", () => {
    expect(toCanonical("아무 상품", "naver", null)).toBe("아무 상품");
  });

  test("네이버 플랫폼: naver 필드에서 정확 매칭한다", () => {
    expect(toCanonical("[리커밋] 벚꽃 끈갈피", "naver", mapping)).toBe("벚꽃 끈갈피");
  });

  test("쿠팡 플랫폼: coupang 필드에서 정확 매칭한다", () => {
    expect(toCanonical("벚꽃 비즈 북마크", "coupang", mapping)).toBe("벚꽃 끈갈피");
  });

  test("네이버에서 매칭 안 되면 원본 이름을 반환한다", () => {
    expect(toCanonical("미등록 상품", "naver", mapping)).toBe("미등록 상품");
  });

  test("쿠팡에서 매칭 안 되면 원본 이름을 반환한다", () => {
    expect(toCanonical("미등록 상품", "coupang", mapping)).toBe("미등록 상품");
  });

  test("오프라인: canonical 정확 매칭 (1단계)", () => {
    expect(toCanonical("벚꽃 끈갈피", "offline", mapping)).toBe("벚꽃 끈갈피");
  });

  test("오프라인: naver/coupang 필드 교차 매칭 (2단계)", () => {
    expect(toCanonical("[리커밋] 벚꽃 끈갈피", "offline", mapping)).toBe("벚꽃 끈갈피");
    expect(toCanonical("벚꽃 비즈 북마크", "offline", mapping)).toBe("벚꽃 끈갈피");
  });

  test("오프라인: 키워드 유사도 매칭 (3단계, threshold 0.5 이상)", () => {
    // "벚꽃" 키워드가 "벚꽃 끈갈피"의 extractKeywords와 겹침
    // extractKeywords("벚꽃 새상품") → {"벚꽃", "새상품"}
    // extractKeywords("벚꽃 끈갈피") → {"벚꽃"} (끈갈피는 불용어)
    // jaccard: intersection=1 / union=2 = 0.5 → threshold 이상이면 매칭
    expect(toCanonical("벚꽃 새상품", "offline", mapping)).toBe("벚꽃 끈갈피");
  });

  test("오프라인: 유사도가 threshold 미만이면 원본 반환", () => {
    // extractKeywords("완전히 다른 상품명") → {"완전히", "다른", "상품명"}
    // 어떤 매핑과도 유사도가 0.5 미만
    expect(toCanonical("완전히 다른 상품명", "offline", mapping)).toBe("완전히 다른 상품명");
  });

  test("platform이 undefined면 오프라인 로직을 사용한다", () => {
    // undefined일 때 naver/coupang 분기를 타지 않으므로 offline 로직
    expect(toCanonical("벚꽃 끈갈피", undefined, mapping)).toBe("벚꽃 끈갈피");
  });
});
