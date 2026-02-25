/**
 * 저장된 레포트에서 네이버·쿠팡 상품명을 읽어
 * 유사한 이름을 자동으로 묶어 data/product-mapping.json 초안을 생성.
 *
 * 실행: npx tsx scripts/generate-mapping.ts
 *
 * 생성 후 data/product-mapping.json을 열어 canonical(대표 상품명)을 편집하세요.
 * confirmedByUser를 true로 바꾸면 대시보드에서 통합 상품명이 적용됩니다.
 */
import fs from "fs/promises";
import path from "path";
import { ProductMappingConfig, ProductMapping } from "../src/lib/types";
import {
  extractKeywords,
  jaccardSimilarity,
  cleanProductName,
} from "../src/lib/calculations/product";

const DATA_DIR = path.join(process.cwd(), "data");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const OUTPUT_PATH = path.join(DATA_DIR, "product-mapping.json");

async function main() {
  // ── 레포트 전체 로드 ─────────────────────────────────────────────────
  const files = (await fs.readdir(REPORTS_DIR)).filter((f) =>
    f.endsWith(".json")
  );

  const naverNames = new Set<string>();
  const coupangNames = new Set<string>();

  for (const file of files) {
    const raw = await fs.readFile(path.join(REPORTS_DIR, file), "utf-8");
    const report = JSON.parse(raw);

    (report.naver?.products ?? []).forEach((p: { productName: string }) =>
      naverNames.add(p.productName)
    );
    (report.coupang?.products ?? []).forEach((p: { productName: string }) =>
      coupangNames.add(p.productName)
    );
  }

  console.log(`네이버 상품: ${naverNames.size}종, 쿠팡 상품: ${coupangNames.size}종`);

  // ── 유사도 기반 매칭 (네이버 → 쿠팡) ─────────────────────────────────
  const SIMILARITY_THRESHOLD = 0.25; // 이 값 이상이면 같은 상품으로 간주

  const mappings: ProductMapping[] = [];
  const matchedCoupang = new Set<string>(); // 이미 매칭된 쿠팡 상품명

  for (const naverName of naverNames) {
    const naverKw = extractKeywords(naverName);
    let bestScore = 0;
    let bestCoupang: string | null = null;

    for (const coupangName of coupangNames) {
      if (matchedCoupang.has(coupangName)) continue;
      const score = jaccardSimilarity(naverKw, extractKeywords(coupangName));
      if (score > bestScore) {
        bestScore = score;
        bestCoupang = coupangName;
      }
    }

    if (bestCoupang && bestScore >= SIMILARITY_THRESHOLD) {
      // 쿠팡명 기반으로 canonical 초안 생성 (접두어 제거)
      mappings.push({
        canonical: cleanProductName(bestCoupang),
        naver: naverName,
        coupang: bestCoupang,
      });
      matchedCoupang.add(bestCoupang);
    } else {
      // 쿠팡 매칭 없음 → 네이버 단독
      mappings.push({
        canonical: cleanProductName(naverName),
        naver: naverName,
      });
    }
  }

  // 쿠팡에만 있는 상품 추가
  for (const coupangName of coupangNames) {
    if (!matchedCoupang.has(coupangName)) {
      mappings.push({
        canonical: cleanProductName(coupangName),
        coupang: coupangName,
      });
    }
  }

  // canonical 기준 정렬
  mappings.sort((a, b) => a.canonical.localeCompare(b.canonical, "ko"));

  // ── 기존 파일 병합 (이미 사용자가 편집했으면 canonical 보존) ──────────
  let existingConfig: ProductMappingConfig | null = null;
  try {
    const existingRaw = await fs.readFile(OUTPUT_PATH, "utf-8");
    existingConfig = JSON.parse(existingRaw);
  } catch {
    // 파일 없으면 무시
  }

  // 기존 파일이 있으면 confirmedByUser 여부와 관계없이 canonical 항상 보존
  const existingMap = new Map<string, string>(); // naver+coupang key → canonical
  if (existingConfig) {
    for (const m of existingConfig.mappings) {
      const key = `${m.naver ?? ""}||${m.coupang ?? ""}`;
      existingMap.set(key, m.canonical);
    }
  }

  const finalMappings = mappings.map((m) => {
    const key = `${m.naver ?? ""}||${m.coupang ?? ""}`;
    const preservedCanonical = existingMap.get(key);
    return preservedCanonical ? { ...m, canonical: preservedCanonical } : m;
  });

  const config: ProductMappingConfig = {
    mappings: finalMappings,
    generatedAt: new Date().toISOString(),
    confirmedByUser: existingConfig?.confirmedByUser ?? false,
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(config, null, 2), "utf-8");

  console.log(`\n✅ ${OUTPUT_PATH} 생성 완료 (${finalMappings.length}개 항목)`);
  console.log("\n─── 매핑 결과 미리보기 ───────────────────────────────────────");
  for (const m of finalMappings) {
    const naverPart = m.naver ? `  네이버: ${m.naver.slice(0, 35)}` : "  네이버: (없음)";
    const coupangPart = m.coupang ? `\n  쿠팡:   ${m.coupang.slice(0, 35)}` : "\n  쿠팡:   (없음)";
    console.log(`\n[${m.canonical}]`);
    console.log(naverPart + coupangPart);
  }
  console.log("\n─────────────────────────────────────────────────────────────");
  console.log("data/product-mapping.json을 열어 canonical 이름을 원하는 대로 수정하세요.");
  console.log('수정 완료 후 "confirmedByUser": true 로 바꾸면 대시보드에 반영됩니다.');
}

main().catch((e) => {
  console.error("❌ 에러:", e);
  process.exit(1);
});
