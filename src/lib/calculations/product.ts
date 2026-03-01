import {
  ProductSales,
  Platform,
  ProductCategory,
  ProductMappingConfig,
} from "@/lib/types";
import { OFFLINE_SIMILARITY_THRESHOLD } from "@/lib/config";

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

// ─── 상품명 키워드 유틸 (mapping-store, generate-mapping 공유) ──────────────

/** 상품명 비교 시 무시할 불용어 */
export const STOP_WORDS = new Set([
  // 공통 제품 유형
  "끈갈피", "책갈피", "비즈", "북마크", "끈", "북클립",
  // 판매 목적어
  "선물", "독서모임", "책선물", "독서템", "독서용품", "독서",
  // 키워드성 수식어
  "리커밋", "맞춤제작",
  // 기타 노이즈
  "handmade", "-", "·", "—", "비즈책갈피", "비즈끈갈피",
  "과일", "모음",
]);

/** 상품명 → 비교용 키워드 집합 (불용어·특수문자 제거) */
export function extractKeywords(name: string): Set<string> {
  const cleaned = name
    .replace(/\[.*?\]/g, "")
    .replace(/[^\uAC00-\uD7A3a-zA-Z\s]/g, " ")
    .toLowerCase()
    .trim();
  return new Set(
    cleaned.split(/\s+/).filter((w) => w.length > 0 && !STOP_WORDS.has(w))
  );
}

/** Jaccard 유사도 (0~1) */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

/** 상품명에서 [리커밋] 등 접두어를 제거한 정제 이름 */
export function cleanProductName(name: string): string {
  return name.replace(/\[.*?\]\s*/g, "").trim();
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
      const score = jaccardSimilarity(kw, extractKeywords(m.canonical));
      if (score > bestScore) {
        bestScore = score;
        bestCanonical = m.canonical;
      }
    }
    if (bestScore >= OFFLINE_SIMILARITY_THRESHOLD) return bestCanonical;
  }

  return name;
}
