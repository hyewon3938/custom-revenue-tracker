import fs from "fs/promises";
import path from "path";
import {
  MonthlyReport,
  NaverData,
  CoupangData,
  OfflineData,
  SponsorshipData,
  DeepPartial,
} from "@/lib/types";
import {
  calcPlatformProfit,
  calcNaverShippingStats,
  naverMaterialBase,
  coupangMaterialBase,
  calcOfflineVenueProfit,
} from "@/lib/calculations/profit";
import { reclassifyAndSummarize } from "@/lib/calculations/product";
import { rebuildDerivedFields } from "@/lib/calculations/ranking";
import { loadProductMapping } from "@/lib/storage/mapping-store";
import { deepMerge } from "@/lib/utils/deep-merge";
import { pad, getPrevMonth } from "@/lib/utils/format";
import { REVIEW_MARKETING_COST_PER_HANDMADE } from "@/lib/config";
import { DEFAULT_SPONSORSHIP } from "@/lib/constants";

const DATA_DIR = path.join(process.cwd(), "data", "reports");

// ─── 버전 관리 상수 ─────────────────────────────────────────────────────
const MAX_VERSIONS = 5;
const VERSION_REGEX = /^(\d{4})-(\d{2})\.v(\d+)\.json$/;
const REPORT_REGEX = /^(\d{4})-(\d{2})\.json$/;

// 파일별 쓰기 잠금 — 동시 PATCH 요청으로 인한 JSON 손상 방지
const writeLocks = new Map<string, Promise<void>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeLocks.set(key, next.then(() => {}, () => {}));
  return next;
}

function getReportPath(year: number, month: number): string {
  return path.join(DATA_DIR, `${year}-${pad(month)}.json`);
}

function getVersionPath(year: number, month: number, timestamp: number): string {
  return path.join(DATA_DIR, `${year}-${pad(month)}.v${timestamp}.json`);
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

// ─── 버전 관리 내부 헬퍼 ────────────────────────────────────────────────

/** 오래된 백업 자동 삭제 (MAX_VERSIONS 초과분) */
async function deleteOldVersions(year: number, month: number): Promise<void> {
  const versions = await listVersions(year, month);
  if (versions.length <= MAX_VERSIONS) return;
  const toDelete = versions.slice(MAX_VERSIONS);
  for (const v of toDelete) {
    await fs.unlink(getVersionPath(year, month, v.timestamp)).catch(() => {});
  }
}

/** 현재 레포트를 타임스탬프 백업 파일로 복사 */
async function createBackup(year: number, month: number): Promise<number | null> {
  const filePath = getReportPath(year, month);
  try {
    await fs.access(filePath);
  } catch {
    return null; // 기존 파일 없으면 백업할 것 없음
  }
  const timestamp = Date.now();
  await fs.copyFile(filePath, getVersionPath(year, month, timestamp));
  await deleteOldVersions(year, month);
  return timestamp;
}

// ─── 버전 관리 export 함수 ──────────────────────────────────────────────

/** 특정 월의 백업 버전 목록 (최신순) */
export async function listVersions(
  year: number,
  month: number
): Promise<{ timestamp: number; date: string; size: number }[]> {
  await ensureDataDir();
  const prefix = `${year}-${pad(month)}.v`;
  const files = await fs.readdir(DATA_DIR);
  const versions: { timestamp: number; date: string; size: number }[] = [];

  for (const f of files) {
    if (!f.startsWith(prefix) || !f.endsWith(".json")) continue;
    const match = f.match(VERSION_REGEX);
    if (!match) continue;
    const ts = parseInt(match[3]);
    const stat = await fs.stat(path.join(DATA_DIR, f));
    versions.push({ timestamp: ts, date: new Date(ts).toISOString(), size: stat.size });
  }

  return versions.sort((a, b) => b.timestamp - a.timestamp);
}

/** 백업 버전으로 복구 (현재 데이터는 자동 백업) */
export async function restoreVersion(
  year: number,
  month: number,
  timestamp: number
): Promise<MonthlyReport> {
  const filePath = getReportPath(year, month);
  const versionPath = getVersionPath(year, month, timestamp);

  try {
    await fs.access(versionPath);
  } catch {
    throw new Error(`해당 버전을 찾을 수 없습니다: ${timestamp}`);
  }

  return withLock(filePath, async () => {
    // 복구 전 현재 데이터 백업
    await createBackup(year, month);
    // 버전 파일을 현재 경로로 복사
    await fs.copyFile(versionPath, filePath);
    // 마이그레이션 적용 + 타임스탬프 갱신
    const raw = await fs.readFile(filePath, "utf-8");
    const report = migrateReport(JSON.parse(raw));
    report.lastModifiedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
    return report;
  });
}

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

/** 기존 레포트 마이그레이션 */
function migrateReport(raw: Record<string, unknown>): MonthlyReport {
  // offline이 배열이 아닌 경우 (구버전) → 배열로 래핑
  if (raw.offline && !Array.isArray(raw.offline)) {
    const single = raw.offline as Record<string, unknown>;
    if (!single.venueId) single.venueId = "gosan";
    raw.offline = [single];
  }
  // NaverData에 shippingCollected/payerCount 없는 경우 기본값 추가
  const naver = raw.naver as Record<string, unknown> | undefined;
  if (naver) {
    if (naver.shippingCollected === undefined) naver.shippingCollected = 0;
    if (naver.payerCount === undefined) naver.payerCount = 0;
  }
  // warnings 필드 없는 기존 레포트 호환
  if (!raw.warnings) raw.warnings = [];
  return raw as unknown as MonthlyReport;
}

/** 레포트 로드. 없으면 null 반환 */
export async function loadReport(
  year: number,
  month: number
): Promise<MonthlyReport | null> {
  const filePath = getReportPath(year, month);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return migrateReport(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

// ─── updateReport 서브 함수 ────────────────────────────────────────────────


/** 오프라인 입점처 배열에 추가/삭제/수정 반영 */
function applyOfflineUpdates(
  existing: OfflineData[],
  updates: {
    offline?: DeepPartial<OfflineData>;
    offlineVenueId?: string;
    addOfflineVenue?: { id: string; name: string };
    removeOfflineVenueId?: string;
  }
): OfflineData[] {
  let venues = [...existing];

  if (updates.addOfflineVenue) {
    const { id, name } = updates.addOfflineVenue;
    if (!venues.some((v) => v.venueId === id)) {
      venues.push({
        venueId: id,
        venueName: name,
        revenue: 0,
        totalQuantity: 0,
        handmadeQuantity: 0,
        otherQuantity: 0,
        fees: { commissionFee: 0, logisticsFee: 0, adFee: 0, settlementAmount: 0 },
        profit: { profit: 0, materialCost: 0, netProfit: 0 },
        products: [],
      });
    }
  }

  if (updates.removeOfflineVenueId) {
    venues = venues.filter((v) => v.venueId !== updates.removeOfflineVenueId);
  }

  if (updates.offline && updates.offlineVenueId) {
    venues = venues.map((venue) => {
      if (venue.venueId !== updates.offlineVenueId) return venue;
      const merged = deepMerge(venue, updates.offline!);
      if (updates.offline!.products !== undefined) {
        const { products, ...qtySummary } = reclassifyAndSummarize(merged.products);
        return { ...merged, products, ...qtySummary };
      }
      return merged;
    });
  }

  return venues;
}

/** 플랫폼별 카테고리 재분류 + 이익 재계산 */
function recalcPlatformProfits(
  naver: NaverData,
  coupang: CoupangData,
  offlineVenues: OfflineData[]
): { naver: NaverData; coupang: CoupangData; offline: OfflineData[] } {
  const naverReclassified = reclassifyAndSummarize(naver.products);
  const coupangReclassified = reclassifyAndSummarize(coupang.products);

  const offlineWithProfit: OfflineData[] = offlineVenues.map((v) => {
    const { products, ...qtySummary } = reclassifyAndSummarize(v.products);
    return calcOfflineVenueProfit({ ...v, products, ...qtySummary });
  });

  const naverShippingStats = calcNaverShippingStats(
    naver.shippingCollected ?? 0,
    naver.payerCount ?? 0
  );
  const naverFees = { ...naver.fees, logisticsFee: naverShippingStats.sellerCost, adFee: 0 };
  const naverWithProfit: NaverData = {
    ...naver,
    fees: naverFees,
    shippingStats: naverShippingStats,
    products: naverReclassified.products,
    totalQuantity: naverReclassified.totalQuantity,
    handmadeQuantity: naverReclassified.handmadeQuantity,
    otherQuantity: naverReclassified.otherQuantity,
    profit: calcPlatformProfit(
      naver.revenue, naverFees,
      naverMaterialBase(naver.revenue, naver.shippingCollected ?? 0)
    ),
  };

  const coupangTotalQty = coupangReclassified.totalQuantity;
  const coupangWithProfit: CoupangData = {
    ...coupang,
    products: coupangReclassified.products,
    totalQuantity: coupangTotalQty,
    handmadeQuantity: coupangReclassified.handmadeQuantity,
    otherQuantity: coupangReclassified.otherQuantity,
    profit: calcPlatformProfit(
      coupang.revenue, coupang.fees,
      coupangMaterialBase(coupang.revenue, coupangTotalQty)
    ),
  };

  return { naver: naverWithProfit, coupang: coupangWithProfit, offline: offlineWithProfit };
}

/** 협찬 데이터 병합 + 수량/비용 자동 재계산 */
function mergeSponsorshipData(
  existing: SponsorshipData | undefined,
  patch: DeepPartial<SponsorshipData> | undefined
): SponsorshipData {
  const base = existing ?? DEFAULT_SPONSORSHIP;
  const merged = patch ? deepMerge(base, patch) : base;

  if (patch?.items === undefined) return merged;

  const totalQuantity = merged.items.reduce((s, i) => s + i.quantity, 0);
  const handmadeQuantity = merged.items
    .filter((i) => i.category === "handmade")
    .reduce((s, i) => s + i.quantity, 0);
  const costPerHandmade = REVIEW_MARKETING_COST_PER_HANDMADE;

  return { ...merged, totalQuantity, handmadeQuantity, marketingCost: handmadeQuantity * costPerHandmade };
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
  }
): Promise<MonthlyReport> {
  const existing = await loadReport(year, month);
  if (!existing) {
    throw new Error(`${year}년 ${month}월 레포트가 없습니다. 먼저 수집을 실행해주세요.`);
  }

  // 1) 플랫폼 데이터 병합
  const naver = updates.naver ? deepMerge(existing.naver, updates.naver) : existing.naver;
  const coupang = updates.coupang ? deepMerge(existing.coupang, updates.coupang) : existing.coupang;
  const offlineVenues = applyOfflineUpdates(existing.offline, updates);

  // 2) 카테고리 재분류 + 이익 재계산
  const platforms = recalcPlatformProfits(naver, coupang, offlineVenues);

  // 3) 협찬 데이터 병합
  const sponsorship = mergeSponsorshipData(existing.sponsorship, updates.sponsorship);

  // 4) 파생 필드 재계산 (summary·ranking·matrix)
  const mapping = await loadProductMapping();
  const derived = rebuildDerivedFields(
    platforms.naver, platforms.coupang, platforms.offline, sponsorship, mapping
  );

  const now = new Date().toISOString();
  const updated: MonthlyReport = {
    ...existing,
    ...platforms,
    sponsorship,
    ...derived,
    insights: updates.insights ?? existing.insights,
    insightsGeneratedAt: updates.insights
      ? now
      : existing.insightsGeneratedAt,
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
    .sort((a, b) =>
      a.year !== b.year ? b.year - a.year : b.month - a.month
    );
}

/** 최근 N개월 히스토리 로드 (인사이트 생성용) — [전달, 전전달, ...] 순 */
export async function loadRecentHistory(
  year: number,
  month: number,
  count: number
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

