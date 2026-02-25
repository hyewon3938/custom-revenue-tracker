import {
  ProductSales,
  Platform,
  ProductCategory,
  ProductMappingConfig,
} from "@/lib/types";

// ─── 상품 카테고리 판별 ─────────────────────────────────────────────────────

/** 상품명으로 카테고리 자동 판별 (끈갈피 = handmade, 독서링 = other) */
export function detectCategory(productName: string): ProductCategory {
  if (productName.includes("독서링")) return "other";
  const handmadeKeywords = ["끈갈피", "북마크"];
  return handmadeKeywords.some((kw) => productName.includes(kw))
    ? "handmade"
    : "other";
}

/** products 배열에서 카테고리를 재분류하고 수량 합계를 계산 */
export function reclassifyAndSummarize(products: ProductSales[]) {
  const reclassified = products.map((p) => ({
    ...p,
    category: detectCategory(p.productName),
  }));
  return {
    products: reclassified,
    totalQuantity: reclassified.reduce((s, p) => s + p.quantity, 0),
    handmadeQuantity: reclassified
      .filter((p) => p.category === "handmade")
      .reduce((s, p) => s + p.quantity, 0),
    otherQuantity: reclassified
      .filter((p) => p.category === "other")
      .reduce((s, p) => s + p.quantity, 0),
  };
}

// ─── 상품명 → canonical 해석 ────────────────────────────────────────────────

const PRODUCT_STOP_WORDS = new Set([
  "끈갈피", "책갈피", "비즈", "북마크", "끈", "북클립",
  "선물", "독서모임", "책선물", "독서템", "독서용품", "독서",
  "리커밋", "맞춤제작", "handmade",
]);

function extractKeywords(name: string): Set<string> {
  const cleaned = name
    .replace(/\[.*?\]/g, "")
    .replace(/[^\uAC00-\uD7A3a-zA-Z\s]/g, " ")
    .toLowerCase()
    .trim();
  return new Set(
    cleaned.split(/\s+/).filter((w) => w.length > 0 && !PRODUCT_STOP_WORDS.has(w))
  );
}

function keywordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

/**
 * 상품명 → canonical명 해석.
 * 네이버/쿠팡: 등록된 플랫폼 상품명 정확 매칭.
 * 오프라인 (수기 입력):
 *   1) canonical 정확 매칭
 *   2) naver/coupang 필드 매칭
 *   3) 키워드 유사도 매칭 (threshold 0.5)
 */
export function toCanonical(
  name: string,
  platform: Platform | undefined,
  mapping: ProductMappingConfig | null
): string {
  if (!mapping) return name;

  if (platform === "naver") {
    return mapping.mappings.find((m) => m.naver === name)?.canonical ?? name;
  }
  if (platform === "coupang") {
    return mapping.mappings.find((m) => m.coupang === name)?.canonical ?? name;
  }

  // offline (수기 입력): 단계별 매칭
  const exact = mapping.mappings.find((m) => m.canonical === name);
  if (exact) return exact.canonical;

  const cross = mapping.mappings.find((m) => m.naver === name || m.coupang === name);
  if (cross) return cross.canonical;

  const kw = extractKeywords(name);
  if (kw.size > 0) {
    let bestScore = 0;
    let bestCanonical = name;
    for (const m of mapping.mappings) {
      const score = keywordOverlap(kw, extractKeywords(m.canonical));
      if (score > bestScore) {
        bestScore = score;
        bestCanonical = m.canonical;
      }
    }
    if (bestScore >= 0.5) return bestCanonical;
  }

  return name;
}
