import fs from "fs/promises";
import path from "path";
import {
  MonthlyReport,
  NaverData,
  CoupangData,
  OfflineData,
} from "@/lib/types";
import {
  calcOnlineProfit,
  calcOfflineProfit,
  calcOverallSummary,
  calcPlatformRanking,
  calcOverallRanking,
  calcProductMatrix,
} from "@/lib/calculations/profit";
import { loadProductMapping } from "@/lib/storage/mapping-store";

const DATA_DIR = path.join(process.cwd(), "data", "reports");

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
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), "utf-8");
}

/** 레포트 로드. 없으면 null 반환 */
export async function loadReport(
  year: number,
  month: number
): Promise<MonthlyReport | null> {
  const filePath = getReportPath(year, month);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as MonthlyReport;
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
export async function updateReport(
  year: number,
  month: number,
  updates: {
    naver?: DeepPartial<NaverData>;
    coupang?: DeepPartial<CoupangData>;
    offline?: DeepPartial<OfflineData>;
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
  const coupang = updates.coupang
    ? deepMerge(existing.coupang, updates.coupang)
    : existing.coupang;
  const offlineMerged = updates.offline
    ? deepMerge(existing.offline, updates.offline)
    : existing.offline;

  // offline.products가 교체됐으면 수량 합계 + 입점 수수료 자동 계산
  // 입점 수수료율은 환경변수로 관리 (수기로 직접 수정 가능)
  const offlineCommissionPerItem = parseInt(
    process.env.OFFLINE_COMMISSION_PER_ITEM ?? "0"
  );
  const offline: OfflineData = (() => {
    if (updates.offline?.products === undefined) return offlineMerged;
    const totalQuantity = offlineMerged.products.reduce((s, p) => s + p.quantity, 0);
    return {
      ...offlineMerged,
      totalQuantity,
      handmadeQuantity: offlineMerged.products
        .filter((p) => p.category === "handmade")
        .reduce((s, p) => s + p.quantity, 0),
      otherQuantity: offlineMerged.products
        .filter((p) => p.category === "other")
        .reduce((s, p) => s + p.quantity, 0),
      fees: {
        ...offlineMerged.fees,
        commissionFee: totalQuantity * offlineCommissionPerItem,
      },
    };
  })();

  // 플랫폼 데이터가 변경되면 이익·요약·랭킹 재계산
  const naverWithProfit: NaverData = {
    ...naver,
    profit: calcOnlineProfit(naver.revenue, naver.fees),
  };
  const coupangWithProfit: CoupangData = {
    ...coupang,
    profit: calcOnlineProfit(coupang.revenue, coupang.fees),
  };
  const offlineWithProfit: OfflineData = {
    ...offline,
    profit: calcOfflineProfit(offline.revenue, offline.fees),
  };

  const mapping = await loadProductMapping();

  const summary = calcOverallSummary(
    naverWithProfit,
    coupangWithProfit,
    offlineWithProfit
  );
  const naverRanking = calcPlatformRanking(naverWithProfit.products, 3, mapping);
  const coupangRanking = calcPlatformRanking(coupangWithProfit.products, 3, mapping);
  const offlineRanking = calcPlatformRanking(offlineWithProfit.products, 3, mapping);
  const overallRanking = calcOverallRanking(
    naverWithProfit.products,
    coupangWithProfit.products,
    offlineWithProfit.products,
    mapping,
    5
  );
  const productMatrix = calcProductMatrix(
    naverWithProfit.products,
    coupangWithProfit.products,
    offlineWithProfit.products,
    mapping
  );

  const updated: MonthlyReport = {
    ...existing,
    naver: naverWithProfit,
    coupang: coupangWithProfit,
    offline: offlineWithProfit,
    summary,
    naverRanking,
    coupangRanking,
    offlineRanking,
    overallRanking,
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

// ─── 유틸 ──────────────────────────────────────────────────────────────────

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
