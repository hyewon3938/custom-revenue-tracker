import fs from "fs/promises";
import path from "path";
import { ProductMappingConfig, ProductSales } from "@/lib/types";
import {
  buildNewProductMappings,
  mergeProductMappings,
} from "@/lib/calculations/mapping";
import { isEnoent } from "@/lib/utils/fs";

const MAPPING_PATH = path.join(process.cwd(), "data", "product-mapping.json");

/** product-mapping.json 로드. 파일 없으면 null 반환 */
export async function loadProductMapping(): Promise<ProductMappingConfig | null> {
  try {
    const raw = await fs.readFile(MAPPING_PATH, "utf-8");
    return JSON.parse(raw) as ProductMappingConfig;
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

/** product-mapping.json 저장 */
async function saveProductMapping(config: ProductMappingConfig): Promise<void> {
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

  const newMappings = buildNewProductMappings(
    existingMappings,
    naverProducts,
    coupangProducts
  );
  if (newMappings.length === 0) return 0;

  const updated: ProductMappingConfig = {
    mappings: mergeProductMappings(existingMappings, newMappings),
    generatedAt: config?.generatedAt ?? new Date().toISOString(),
    // 신규 항목이 추가됐으므로 다시 검토 필요
    confirmedByUser: false,
  };

  await saveProductMapping(updated);
  return newMappings.length;
}
