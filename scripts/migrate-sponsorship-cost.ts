/**
 * 협찬 비용 공식 변경(#12)에 따른 기존 레포트 일괄 재계산 스크립트.
 *
 * 사용법: tsx scripts/migrate-sponsorship-cost.ts
 *
 * 동작:
 * - listReports로 모든 저장된 (year, month) 조회
 * - 각 레포트를 loadReport → sponsorship.items 단가가 모두 입력된 경우에만
 *   updateReport({ sponsorship: { items: 기존 items } })를 호출하여 자동 재계산.
 * - 단가가 누락된 월은 수기 입력값을 보존하기 위해 건너뛰고 로그만 남김.
 */
import {
  listReports,
  loadReport,
  updateReport,
} from "@/lib/storage/report-store";

async function main() {
  const reports = await listReports();
  const results: { year: number; month: number; status: string }[] = [];

  for (const { year, month } of reports) {
    const existing = await loadReport(year, month);
    if (!existing) {
      results.push({ year, month, status: "skip: not found" });
      continue;
    }

    const items = existing.sponsorship?.items ?? [];
    if (items.length === 0) {
      results.push({ year, month, status: "skip: no items" });
      continue;
    }

    const allHaveUnitPrice = items.every(
      (i) => i.unitPrice != null && i.unitPrice > 0,
    );
    if (!allHaveUnitPrice) {
      results.push({ year, month, status: "skip: missing unitPrice" });
      continue;
    }

    // items 그대로 다시 넘기면 mergeSponsorshipData가 새 공식으로 marketingCost 재계산
    await updateReport(year, month, { sponsorship: { items } });
    results.push({ year, month, status: "migrated" });
  }

  console.table(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
