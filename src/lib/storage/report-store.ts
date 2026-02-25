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
  gosanMaterialBase,
  reclassifyAndSummarize,
  rebuildDerivedFields,
} from "@/lib/calculations/profit";
import { deepMerge } from "@/lib/utils/deep-merge";
import { getPrevMonth } from "@/lib/utils/format";

const DATA_DIR = path.join(process.cwd(), "data", "reports");

// 파일별 쓰기 잠금 — 동시 PATCH 요청으로 인한 JSON 손상 방지
const writeLocks = new Map<string, Promise<void>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeLocks.set(key, next.then(() => {}, () => {}));
  return next;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function getReportPath(year: number, month: number): string {
  return path.join(DATA_DIR, `${year}-${pad(month)}.json`);
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/** 레포트를 JSON 파일로 저장 */
export async function saveReport(report: MonthlyReport): Promise<void> {
  await ensureDataDir();
  const filePath = getReportPath(report.period.year, report.period.month);
  await withLock(filePath, () =>
    fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8")
  );
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

const DEFAULT_SPONSORSHIP: SponsorshipData = {
  items: [],
  marketingCost: 0,
  totalQuantity: 0,
  handmadeQuantity: 0,
};

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
    const matBase = v.venueId === "gosan"
      ? gosanMaterialBase(v.revenue, v.fees.commissionFee)
      : v.revenue;
    return {
      ...v, products, ...qtySummary,
      profit: calcPlatformProfit(v.revenue, v.fees, matBase, "OFFLINE_MATERIAL_RATE"),
    };
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
  const costPerHandmade = parseInt(process.env.REVIEW_MARKETING_COST_PER_HANDMADE ?? "0");

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
  const derived = await rebuildDerivedFields(
    platforms.naver, platforms.coupang, platforms.offline, sponsorship
  );

  const updated: MonthlyReport = {
    ...existing,
    ...platforms,
    sponsorship,
    ...derived,
    insights: updates.insights ?? existing.insights,
    lastModifiedAt: new Date().toISOString(),
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
    .filter((f) => f.endsWith(".json"))
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

