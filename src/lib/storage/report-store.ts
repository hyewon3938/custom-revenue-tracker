import fs from "fs/promises";
import path from "path";
import { MonthlyReport, PlatformData, OfflineData } from "@/lib/types";
import {
  calculateProfit,
  calculateHandmadeRanking,
} from "@/lib/calculations/profit";

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
 * naver·coupang·offline 중 하나라도 변경되면 profit·handmadeRanking 재계산.
 *
 * 사용 예:
 *   // 네이버 광고비만 수정
 *   await updateReport(2026, 2, { naver: { fees: { adFee: 150000 } } });
 *
 *   // 오프라인 매출 입력
 *   await updateReport(2026, 2, { offline: { revenue: 500000 } });
 */
export async function updateReport(
  year: number,
  month: number,
  updates: {
    naver?: DeepPartial<PlatformData>;
    coupang?: DeepPartial<PlatformData>;
    offline?: DeepPartial<OfflineData>;
    insights?: MonthlyReport["insights"];
  }
): Promise<MonthlyReport> {
  const existing = await loadReport(year, month);
  if (!existing) {
    throw new Error(`${year}년 ${month}월 레포트가 없습니다. 먼저 수집을 실행해주세요.`);
  }

  const naver = updates.naver
    ? deepMerge(existing.naver, updates.naver)
    : existing.naver;
  const coupang = updates.coupang
    ? deepMerge(existing.coupang, updates.coupang)
    : existing.coupang;
  const offline = updates.offline
    ? deepMerge(existing.offline, updates.offline)
    : existing.offline;

  // 플랫폼 데이터가 변경되면 수익·랭킹 재계산
  const profit = calculateProfit(naver, coupang, offline);
  const handmadeRanking = calculateHandmadeRanking(naver, coupang, offline);

  const updated: MonthlyReport = {
    ...existing,
    naver,
    coupang,
    offline,
    profit,
    handmadeRanking,
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

// ─── 유틸 ────────────────────────────────────────────────────────────────────

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
