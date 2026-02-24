import fs from "fs/promises";
import path from "path";
import { ProductMappingConfig } from "@/lib/types";

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
