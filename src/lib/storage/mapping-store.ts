import fs from "fs/promises";
import path from "path";
import { ProductMappingConfig, ProductMapping, ProductSales } from "@/lib/types";
import {
  extractKeywords,
  jaccardSimilarity,
  cleanProductName,
} from "@/lib/calculations/product";
import { MAPPING_SIMILARITY_THRESHOLD } from "@/lib/config";

const MAPPING_PATH = path.join(process.cwd(), "data", "product-mapping.json");

/** product-mapping.json 로드. 파일 없으면 null 반환 */
export async function loadProductMapping(): Promise<ProductMappingConfig | null> {
  try {
    const raw = await fs.readFile(MAPPING_PATH, "utf-8");
    return JSON.parse(raw) as ProductMappingConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** product-mapping.json 저장 */
export async function saveProductMapping(
  config: ProductMappingConfig
): Promise<void> {
  await fs.mkdir(path.dirname(MAPPING_PATH), { recursive: true });
  await fs.writeFile(MAPPING_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// ─── 신규 상품 자동 동기화 ─────────────────────────────────────────────────


/**
 * 수집된 상품 목록을 보고 매핑 파일에 없는 신규 상품을 자동으로 추가.
 * 기존 매핑(canonical 포함)은 절대 수정하지 않고 신규 항목만 append.
 *
 * @returns 추가된 항목 수 (0이면 변경 없음)
 */
export async function syncNewProductsToMapping(
  naverProducts: ProductSales[],
  coupangProducts: ProductSales[]
): Promise<number> {
  const config = await loadProductMapping();
  const existingMappings = config?.mappings ?? [];

  // 이미 매핑된 원본 상품명 수집
  const mappedNaver = new Set(
    existingMappings.map((m) => m.naver).filter(Boolean) as string[]
  );
  const mappedCoupang = new Set(
    existingMappings.map((m) => m.coupang).filter(Boolean) as string[]
  );

  // 새로 나타난 상품명만 추출 (중복 제거)
  const newNaverNames = [
    ...new Set(naverProducts.map((p) => p.productName)),
  ].filter((n) => !mappedNaver.has(n));

  const newCoupangNames = [
    ...new Set(coupangProducts.map((p) => p.productName)),
  ].filter((n) => !mappedCoupang.has(n));

  if (newNaverNames.length === 0 && newCoupangNames.length === 0) return 0;

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

  const updated: ProductMappingConfig = {
    mappings: [...existingMappings, ...newMappings].sort((a, b) =>
      a.canonical.localeCompare(b.canonical, "ko")
    ),
    generatedAt: config?.generatedAt ?? new Date().toISOString(),
    // 신규 항목이 추가됐으므로 다시 검토 필요
    confirmedByUser: false,
  };

  await saveProductMapping(updated);
  return newMappings.length;
}
