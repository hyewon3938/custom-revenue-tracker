/**
 * 현재 product-mapping.json을 모든 저장된 레포트에 재적용.
 * canonical 기준으로 상품 랭킹·매트릭스를 다시 계산하고 레포트를 덮어씀.
 *
 * 사용법:
 *   1. data/product-mapping.json 에서 canonical 이름 수정
 *   2. yarn mapping:apply
 *   3. 콘솔에서 업데이트된 상품 목록 확인
 */
import fs from "fs/promises";
import path from "path";
import { MonthlyReport } from "../src/lib/types";
import {
  calcOverallRanking,
  calcProductMatrix,
} from "../src/lib/calculations/ranking";
import {
  loadProductMapping,
} from "../src/lib/storage/mapping-store";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

async function main() {
  const mapping = await loadProductMapping();
  if (!mapping) {
    console.error("❌ data/product-mapping.json 파일이 없습니다.");
    console.error("   먼저 yarn mapping:generate 를 실행해주세요.");
    process.exit(1);
  }

  const files = (await fs.readdir(REPORTS_DIR))
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    console.error("❌ 저장된 레포트가 없습니다. 먼저 수집을 실행해주세요.");
    process.exit(1);
  }

  console.log(`매핑 항목: ${mapping.mappings.length}개`);
  console.log(`레포트 ${files.length}개에 재적용 중...\n`);

  for (const file of files) {
    const filePath = path.join(REPORTS_DIR, file);
    const raw = await fs.readFile(filePath, "utf-8");
    const report: MonthlyReport = JSON.parse(raw);

    const { year, month } = report.period;

    // offline이 배열이면 flatMap, 단일 객체면 직접 참조 (마이그레이션 전 호환)
    const offlineArr = Array.isArray(report.offline) ? report.offline : [report.offline];
    const allOfflineProducts = offlineArr.flatMap((v) => v.products);

    const overallRanking = calcOverallRanking(
      report.naver.products,
      report.coupang.products,
      allOfflineProducts,
      mapping,
      5
    );
    const productMatrix = calcProductMatrix(
      report.naver.products,
      report.coupang.products,
      allOfflineProducts,
      mapping
    );

    const updated: MonthlyReport = {
      ...report,
      overallRanking,
      productMatrix,
      lastModifiedAt: new Date().toISOString(),
    };

    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8");

    // ── 결과 출력 ─────────────────────────────────────────────────────
    console.log(`✅ ${year}년 ${month}월`);
    console.log("  [통합 TOP5]");
    for (const r of overallRanking) {
      const parts = [
        r.naver > 0 ? `네이버 ${r.naver}` : null,
        r.coupang > 0 ? `쿠팡 ${r.coupang}` : null,
        r.offline > 0 ? `오프라인 ${r.offline}` : null,
      ].filter(Boolean);
      console.log(
        `    ${r.rank}위 ${r.productName} — 합계 ${r.total}개 (${parts.join(", ")})`
      );
    }

    console.log("  [상품 × 플랫폼]");
    for (const row of productMatrix) {
      const parts = [
        row.naver > 0 ? `네이버 ${row.naver}` : null,
        row.coupang > 0 ? `쿠팡 ${row.coupang}` : null,
        row.offline > 0 ? `오프라인 ${row.offline}` : null,
      ].filter(Boolean);
      console.log(
        `    ${row.productName} — ${row.total}개 (${parts.join(", ")})`
      );
    }
    console.log();
  }

  console.log("완료. 대시보드를 새로고침하면 업데이트된 상품 목록이 보입니다.");
}

main().catch((e) => {
  console.error("❌ 에러:", e);
  process.exit(1);
});
