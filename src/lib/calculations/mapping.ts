import { ProductMapping, ProductSales } from "@/lib/types";
import {
  extractKeywords,
  jaccardSimilarity,
  cleanProductName,
} from "@/lib/calculations/product";
import { MAPPING_SIMILARITY_THRESHOLD } from "@/lib/config";

// ─── 신규 상품 매핑 계산 (mapping-store 의 자동 동기화용) ───────────────────

/**
 * 수집된 상품 중 기존 매핑에 없는 신규 상품의 매핑 항목을 만든다.
 * 네이버 상품을 나온 순서대로 돌며 아직 짝이 없는 쿠팡 신규 상품 중
 * 유사도가 가장 높은 것과 묶고(동점이면 먼저 나온 쪽), 임계값 미만이면 단독 항목으로 둔다.
 * 짝을 못 찾은 쿠팡 상품은 뒤에 단독 항목으로 붙는다.
 *
 * @returns 추가할 매핑 목록 (신규 상품이 없으면 빈 배열)
 */
export function buildNewProductMappings(
  existingMappings: ProductMapping[],
  naverProducts: ProductSales[],
  coupangProducts: ProductSales[],
): ProductMapping[] {
  // 이미 매핑된 원본 상품명 수집
  const mappedNaver = new Set(
    existingMappings.map((m) => m.naver).filter(Boolean) as string[],
  );
  const mappedCoupang = new Set(
    existingMappings.map((m) => m.coupang).filter(Boolean) as string[],
  );

  // 새로 나타난 상품명만 추출 (중복 제거)
  const newNaverNames = [
    ...new Set(naverProducts.map((p) => p.productName)),
  ].filter((n) => !mappedNaver.has(n));

  const newCoupangNames = [
    ...new Set(coupangProducts.map((p) => p.productName)),
  ].filter((n) => !mappedCoupang.has(n));

  // 새 상품끼리 유사도 매칭
  const newMappings: ProductMapping[] = [];
  const matchedCoupang = new Set<string>();

  for (const naverName of newNaverNames) {
    const naverKw = extractKeywords(naverName);
    let bestScore = 0;
    let bestCoupang: string | null = null;

    for (const coupangName of newCoupangNames) {
      if (matchedCoupang.has(coupangName)) continue;
      const score = jaccardSimilarity(naverKw, extractKeywords(coupangName));
      if (score > bestScore) {
        bestScore = score;
        bestCoupang = coupangName;
      }
    }

    if (bestCoupang && bestScore >= MAPPING_SIMILARITY_THRESHOLD) {
      newMappings.push({
        canonical: cleanProductName(bestCoupang),
        naver: naverName,
        coupang: bestCoupang,
      });
      matchedCoupang.add(bestCoupang);
    } else {
      newMappings.push({
        canonical: cleanProductName(naverName),
        naver: naverName,
      });
    }
  }

  for (const coupangName of newCoupangNames) {
    if (!matchedCoupang.has(coupangName)) {
      newMappings.push({
        canonical: cleanProductName(coupangName),
        coupang: coupangName,
      });
    }
  }

  return newMappings;
}

/** 기존 매핑 뒤에 신규 매핑을 붙여 canonical 가나다순으로 정렬한 새 배열 */
export function mergeProductMappings(
  existingMappings: ProductMapping[],
  newMappings: ProductMapping[],
): ProductMapping[] {
  return [...existingMappings, ...newMappings].sort((a, b) =>
    a.canonical.localeCompare(b.canonical, "ko"),
  );
}
