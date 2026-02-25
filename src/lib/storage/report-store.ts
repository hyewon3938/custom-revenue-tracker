import fs from "fs/promises";
import path from "path";
import {
  MonthlyReport,
  NaverData,
  CoupangData,
  OfflineData,
  ProductSales,
  SponsorshipData,
} from "@/lib/types";
import {
  calcOnlineProfit,
  calcOfflineProfit,
  calcOverallSummary,
  calcPlatformRanking,
  calcOverallRanking,
  calcProductMatrix,
  calcSponsorExcludedRanking,
} from "@/lib/calculations/profit";
import { loadProductMapping } from "@/lib/storage/mapping-store";
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

/** 기존 레포트 마이그레이션: offline 단일 객체 → 배열 변환 */
function migrateReport(raw: Record<string, unknown>): MonthlyReport {
  // offline이 배열이 아닌 경우 (구버전) → 배열로 래핑
  if (raw.offline && !Array.isArray(raw.offline)) {
    const single = raw.offline as Record<string, unknown>;
    if (!single.venueId) single.venueId = "gosan";
    raw.offline = [single];
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

/**
 * 수기 편집용 업데이트 함수.
 *
 * updates에 포함된 필드만 기존 레포트에 병합하고,
 * 플랫폼 데이터가 변경되면 profit·summary·ranking 자동 재계산.
 */
const DEFAULT_SPONSORSHIP: SponsorshipData = {
  items: [],
  marketingCost: 0,
  totalQuantity: 0,
  handmadeQuantity: 0,
};

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
    throw new Error(
      `${year}년 ${month}월 레포트가 없습니다. 먼저 수집을 실행해주세요.`
    );
  }

  const naver = updates.naver
    ? deepMerge(existing.naver, updates.naver)
    : existing.naver;

  const coupangMerged = updates.coupang
    ? deepMerge(existing.coupang, updates.coupang)
    : existing.coupang;

  // coupang.products가 교체됐으면 수량 합계 자동 재계산
  const coupang: CoupangData =
    updates.coupang?.products !== undefined
      ? { ...coupangMerged, ...calcQuantitySummary(coupangMerged.products) }
      : coupangMerged;

  // ─── 오프라인 다중 입점처 처리 ────────────────────────────────────────
  let offlineVenues: OfflineData[] = [...existing.offline];

  // 입점처 추가 (빈 데이터)
  if (updates.addOfflineVenue) {
    const { id, name } = updates.addOfflineVenue;
    if (!offlineVenues.some((v) => v.venueId === id)) {
      offlineVenues.push({
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

  // 입점처 비활성화 (배열에서 제거)
  if (updates.removeOfflineVenueId) {
    offlineVenues = offlineVenues.filter(
      (v) => v.venueId !== updates.removeOfflineVenueId
    );
  }

  // 특정 입점처 데이터 수정
  if (updates.offline && updates.offlineVenueId) {
    const offlineCommissionPerItem = parseInt(
      process.env.OFFLINE_COMMISSION_PER_ITEM ?? "0"
    );

    offlineVenues = offlineVenues.map((venue) => {
      if (venue.venueId !== updates.offlineVenueId) return venue;

      const merged = deepMerge(venue, updates.offline!);

      // products가 교체됐으면 수량 합계 + 입점 수수료 자동 재계산
      if (updates.offline!.products !== undefined) {
        const qtySummary = calcQuantitySummary(merged.products);
        return {
          ...merged,
          ...qtySummary,
          fees: {
            ...merged.fees,
            commissionFee: qtySummary.totalQuantity * offlineCommissionPerItem,
          },
        };
      }
      return merged;
    });
  }

  // 각 입점처별 이익 재계산
  const offlineWithProfit: OfflineData[] = offlineVenues.map((v) => ({
    ...v,
    profit: calcOfflineProfit(v.revenue, v.fees),
  }));

  // 플랫폼 데이터 이익 재계산
  const naverWithProfit: NaverData = {
    ...naver,
    profit: calcOnlineProfit(naver.revenue, naver.fees),
  };
  const coupangWithProfit: CoupangData = {
    ...coupang,
    profit: calcOnlineProfit(coupang.revenue, coupang.fees),
  };

  // 협찬 데이터 병합
  const existingSponsorship: SponsorshipData = existing.sponsorship ?? DEFAULT_SPONSORSHIP;
  const sponsorshipMerged = updates.sponsorship
    ? deepMerge(existingSponsorship, updates.sponsorship)
    : existingSponsorship;

  // items가 교체됐으면 수량 합계 + 마케팅 비용 자동 재계산
  const sponsorship: SponsorshipData = (() => {
    if (updates.sponsorship?.items === undefined) return sponsorshipMerged;

    const totalQuantity = sponsorshipMerged.items.reduce((s, i) => s + i.quantity, 0);
    const handmadeQuantity = sponsorshipMerged.items
      .filter((i) => i.category === "handmade")
      .reduce((s, i) => s + i.quantity, 0);
    const costPerHandmade = parseInt(process.env.REVIEW_MARKETING_COST_PER_HANDMADE ?? "0");
    const marketingCost = handmadeQuantity * costPerHandmade;

    return { ...sponsorshipMerged, totalQuantity, handmadeQuantity, marketingCost };
  })();

  const mapping = await loadProductMapping();

  // 모든 오프라인 입점처 products 합산
  const allOfflineProducts = offlineWithProfit.flatMap((v) => v.products);

  const summary = calcOverallSummary(
    naverWithProfit,
    coupangWithProfit,
    offlineWithProfit,
    sponsorship.marketingCost
  );
  const naverRanking = calcPlatformRanking(naverWithProfit.products, 3, mapping);
  const coupangRanking = calcPlatformRanking(coupangWithProfit.products, 3, mapping);
  const offlineRanking = calcPlatformRanking(allOfflineProducts, 3, mapping);
  const overallRanking = calcOverallRanking(
    naverWithProfit.products,
    coupangWithProfit.products,
    allOfflineProducts,
    mapping,
    5
  );
  const sponsorExcludedRanking = calcSponsorExcludedRanking(
    naverWithProfit.products,
    coupangWithProfit.products,
    allOfflineProducts,
    sponsorship.items,
    mapping,
    5
  );
  const productMatrix = calcProductMatrix(
    naverWithProfit.products,
    coupangWithProfit.products,
    allOfflineProducts,
    mapping
  );

  const updated: MonthlyReport = {
    ...existing,
    naver: naverWithProfit,
    coupang: coupangWithProfit,
    offline: offlineWithProfit,
    sponsorship,
    summary,
    naverRanking,
    coupangRanking,
    offlineRanking,
    overallRanking,
    sponsorExcludedRanking,
    productMatrix,
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

// ─── 유틸 ──────────────────────────────────────────────────────────────────

/** products 배열에서 총·끈갈피·기타 수량 합계를 계산 */
function calcQuantitySummary(products: ProductSales[]) {
  return {
    totalQuantity: products.reduce((s, p) => s + p.quantity, 0),
    handmadeQuantity: products
      .filter((p) => p.category === "handmade")
      .reduce((s, p) => s + p.quantity, 0),
    otherQuantity: products
      .filter((p) => p.category === "other")
      .reduce((s, p) => s + p.quantity, 0),
  };
}

type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const val = source[key as keyof typeof source];
    if (val === undefined) continue;

    const targetVal = (target as Record<string, unknown>)[key];
    if (
      typeof val === "object" &&
      val !== null &&
      !Array.isArray(val) &&
      typeof targetVal === "object" &&
      targetVal !== null
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetVal as object,
        val as DeepPartial<object>
      );
    } else {
      (result as Record<string, unknown>)[key] = val;
    }
  }
  return result;
}
