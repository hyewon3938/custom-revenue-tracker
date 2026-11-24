import fs from "fs/promises";
import {
  MonthlyReport,
  NaverData,
  CoupangData,
  OfflineData,
  SponsorshipData,
  DeepPartial,
} from "@/lib/types";
import {
  applyOfflineUpdates,
  recalcPlatformProfits,
  mergeSponsorshipData,
} from "@/lib/calculations/report-update";
import { rebuildDerivedFields } from "@/lib/calculations/ranking";
import { loadProductMapping } from "@/lib/storage/mapping-store";
import { withLock } from "@/lib/storage/report-lock";
import { migrateReport } from "@/lib/storage/report-migration";
import {
  DATA_DIR,
  getReportPath,
  ensureDataDir,
} from "@/lib/storage/report-paths";
import { createBackup } from "@/lib/storage/report-versions";
import { deepMerge } from "@/lib/utils/deep-merge";
import { getPrevMonth } from "@/lib/utils/format";
import { isEnoent } from "@/lib/utils/fs";

// 버전 관리 함수는 report-versions.ts 로 옮겼고, 기존 import 경로 유지를 위해 다시 내보낸다.
export { listVersions, restoreVersion } from "@/lib/storage/report-versions";

const REPORT_REGEX = /^(\d{4})-(\d{2})\.json$/;

// ─── 레포트 저장/로드 ───────────────────────────────────────────────────

/** 레포트를 JSON 파일로 저장 (이전 파일은 자동 백업) */
export async function saveReport(report: MonthlyReport): Promise<void> {
  await ensureDataDir();
  const filePath = getReportPath(report.period.year, report.period.month);
  await withLock(filePath, async () => {
    await createBackup(report.period.year, report.period.month);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
  });
}

/** 레포트 로드. 없으면 null 반환 */
export async function loadReport(
  year: number,
  month: number,
): Promise<MonthlyReport | null> {
  const filePath = getReportPath(year, month);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return migrateReport(JSON.parse(raw));
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

// ─── updateReport ──────────────────────────────────────────────────────────

/**
 * 수기 편집용 업데이트 함수.
 * updates에 포함된 필드만 기존 레포트에 병합하고,
 * profit·summary·ranking 자동 재계산.
 */
export async function updateReport(
  year: number,
  month: number,
  updates: {
    naver?: DeepPartial<NaverData>;
    coupang?: DeepPartial<CoupangData>;
    offline?: DeepPartial<OfflineData>;
    offlineVenueId?: string;
    addOfflineVenue?: { id: string; name: string };
    removeOfflineVenueId?: string;
    sponsorship?: DeepPartial<SponsorshipData>;
    insights?: MonthlyReport["insights"];
  },
): Promise<MonthlyReport> {
  const existing = await loadReport(year, month);
  if (!existing) {
    throw new Error(
      `${year}년 ${month}월 레포트가 없습니다. 먼저 수집을 실행해주세요.`,
    );
  }

  // 1) 플랫폼 데이터 병합
  const naver = updates.naver
    ? deepMerge(existing.naver, updates.naver)
    : existing.naver;
  const coupang = updates.coupang
    ? deepMerge(existing.coupang, updates.coupang)
    : existing.coupang;
  const offlineVenues = applyOfflineUpdates(existing.offline, updates);

  // 2) 카테고리 재분류 + 이익 재계산
  const platforms = recalcPlatformProfits(naver, coupang, offlineVenues);

  // 3) 협찬 데이터 병합
  const sponsorship = mergeSponsorshipData(
    existing.sponsorship,
    updates.sponsorship,
  );

  // 4) 파생 필드 재계산 (summary·ranking·matrix)
  const mapping = await loadProductMapping();
  const derived = rebuildDerivedFields(
    platforms.naver,
    platforms.coupang,
    platforms.offline,
    sponsorship,
    mapping,
  );

  const now = new Date().toISOString();
  const updated: MonthlyReport = {
    ...existing,
    ...platforms,
    sponsorship,
    ...derived,
    insights: updates.insights ?? existing.insights,
    insightsGeneratedAt: updates.insights ? now : existing.insightsGeneratedAt,
    lastModifiedAt: now,
  };

  await saveReport(updated);
  return updated;
}

/** 저장된 레포트 목록 (최신순) */
export async function listReports(): Promise<
  { year: number; month: number }[]
> {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  return files
    .filter((f) => REPORT_REGEX.test(f))
    .map((f) => {
      const [y, m] = f.replace(".json", "").split("-").map(Number);
      return { year: y, month: m };
    })
    .sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
}

/** 저장된 전체 레포트를 병렬로 로드 (최신순, 읽는 사이 사라진 월은 제외) */
export async function loadAllReports(): Promise<MonthlyReport[]> {
  const list = await listReports();
  const results = await Promise.all(
    list.map(({ year, month }) => loadReport(year, month)),
  );
  return results.filter((r): r is MonthlyReport => r !== null);
}

/** 최근 N개월 히스토리 로드 (인사이트 생성용) — [전달, 전전달, ...] 순 */
export async function loadRecentHistory(
  year: number,
  month: number,
  count: number,
): Promise<(MonthlyReport | null)[]> {
  const results: (MonthlyReport | null)[] = [];
  let y = year,
    m = month;
  for (let i = 0; i < count; i++) {
    const prev = getPrevMonth(y, m);
    y = prev.year;
    m = prev.month;
    results.push(await loadReport(y, m));
  }
  return results;
}
