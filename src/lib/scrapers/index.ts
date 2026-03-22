import { chromium, Browser, BrowserContext, Page } from "playwright";
import {
  NaverData,
  CoupangData,
  PlatformFees,
  ScrapeWarning,
} from "@/lib/types";
import { pad } from "@/lib/utils/format";
import { loginCoupang } from "./coupang-auth";
import { getValidSessionPath } from "./session-store";
import { scrapeCoupangSalesAnalysis } from "./coupang-sales";
import { scrapeCoupangSettlement } from "./coupang-settlement";
import {
  calcPlatformProfit,
  coupangMaterialBase,
} from "@/lib/calculations/profit";
import { withRetry } from "./with-retry";
import { validateCollectedData } from "./validate";
import { collectNaverDataViaApi } from "@/lib/naver-api/collect";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * 공통 브라우저 + 컨텍스트 + 페이지 생성.
 * storageStatePath가 주어지면 저장된 쿠키/스토리지를 복원한다.
 * 세션 파일이 손상된 경우 경고 후 빈 컨텍스트로 재시도.
 */
async function createBrowserPage(storageStatePath?: string | null): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let context: BrowserContext;
  try {
    context = await browser.newContext({
      userAgent: BROWSER_UA,
      ...(storageStatePath ? { storageState: storageStatePath } : {}),
    });
  } catch {
    console.warn("[세션] 세션 파일 로드 실패 — 새 컨텍스트로 재시도");
    context = await browser.newContext({ userAgent: BROWSER_UA });
  }

  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * 조회 기간 결정:
 * - 이번 달이면 1일 ~ 어제
 * - 지난 달(과거)이면 1일 ~ 말일
 */
export function getDateRange(
  year: number,
  month: number
): { start: string; end: string } {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;

  const lastDay = new Date(year, month, 0).getDate();

  const endDay = isCurrentMonth ? today.getDate() - 1 : lastDay;

  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(endDay)}`,
  };
}

// ─── 플랫폼별 수집 ──────────────────────────────────────────────────────

/**
 * 네이버: 커머스 API로 수집 (브라우저 불필요)
 */
async function collectNaverData(
  year: number,
  month: number
): Promise<{ data: NaverData; warnings: ScrapeWarning[] }> {
  const { start, end } = getDateRange(year, month);
  return collectNaverDataViaApi(start, end);
}

async function collectCoupangData(
  year: number,
  month: number
): Promise<{ data: CoupangData; warnings: ScrapeWarning[] }> {
  const sessionPath = await getValidSessionPath("coupang");
  const { browser, context, page } = await createBrowserPage(sessionPath);
  const warnings: ScrapeWarning[] = [];

  try {
    await loginCoupang(page, context);

    const salesAttempt = await withRetry(
      "coupang-sales",
      () => scrapeCoupangSalesAnalysis(page, year, month),
      null
    );
    if (salesAttempt.failed) {
      warnings.push({
        level: "error",
        message: `쿠팡 판매분석 수집 실패 (재시도 포함): ${salesAttempt.error}`,
      });
    } else if (salesAttempt.retried) {
      warnings.push({
        level: "warn",
        message: "쿠팡 판매분석 첫 번째 시도 실패 후 재시도로 수집 성공.",
      });
    }

    const settlementAttempt = await withRetry(
      "coupang-settlement",
      () => scrapeCoupangSettlement(page, year, month),
      null
    );
    if (settlementAttempt.failed) {
      warnings.push({
        level: "error",
        message: `쿠팡 정산 수집 실패 (재시도 포함): ${settlementAttempt.error}`,
      });
    } else if (settlementAttempt.retried) {
      warnings.push({
        level: "warn",
        message: "쿠팡 정산 첫 번째 시도 실패 후 재시도로 수집 성공.",
      });
    }

    const salesResult = salesAttempt.data;
    const settlementResult = settlementAttempt.data;

    const revenue = settlementResult?.revenue ?? 0;
    const fees: PlatformFees = {
      commissionFee: settlementResult?.commissionFee ?? 0,
      logisticsFee: settlementResult?.logisticsFee ?? 0,
      adFee: settlementResult?.adFee ?? 0,
      settlementAmount: 0, // 쿠팡은 정산금 없음
    };
    const products = salesResult?.products ?? [];
    const handmadeQuantity = products
      .filter((p) => p.category === "handmade")
      .reduce((s, p) => s + p.quantity, 0);
    const totalQuantity = products.reduce((s, p) => s + p.quantity, 0);

    return {
      data: {
        revenue,
        totalQuantity,
        handmadeQuantity,
        otherQuantity: totalQuantity - handmadeQuantity,
        fees,
        profit: calcPlatformProfit(
          revenue, fees, coupangMaterialBase(revenue, totalQuantity)
        ),
        products,
      },
      warnings,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

// ─── 오케스트레이터 ─────────────────────────────────────────────────────

/**
 * 네이버(API)·쿠팡(스크레이퍼) 데이터를 수집해 원시 결과 + 경고를 반환.
 * 수집 후 데이터 정합성 검증을 수행해 경고 목록을 합산.
 */
export async function collectMonthlyData(
  year: number,
  month: number
): Promise<{
  naver: NaverData;
  coupang: CoupangData;
  period: { year: number; month: number };
  dataRange: { start: string; end: string };
  warnings: ScrapeWarning[];
}> {
  const dataRange = getDateRange(year, month);

  const [naverResult, coupangResult] = await Promise.all([
    collectNaverData(year, month),
    collectCoupangData(year, month),
  ]);

  // 재시도 실패 경고 합산
  const scraperWarnings = [
    ...naverResult.warnings,
    ...coupangResult.warnings,
  ];

  // 이미 실패 보고된 수집기는 정합성 검증에서 중복 경고 방지
  const failedScrapers = new Set<string>();
  for (const w of scraperWarnings) {
    if (w.level === "error") {
      // 네이버 API 실패 시 관련 검증 규칙 건너뜀
      if (w.message.includes("네이버 정산 API")) failedScrapers.add("naver-settlement");
      if (w.message.includes("네이버 주문 API") || w.message.includes("네이버 API")) {
        failedScrapers.add("naver-orders");
        failedScrapers.add("naver-sales");
      }
      // 쿠팡 스크레이퍼 실패
      if (w.message.includes("쿠팡 판매분석")) failedScrapers.add("coupang-sales");
      if (w.message.includes("쿠팡 정산")) failedScrapers.add("coupang-settlement");
    }
  }

  const validationWarnings = validateCollectedData(
    naverResult.data,
    coupangResult.data,
    failedScrapers
  );

  return {
    naver: naverResult.data,
    coupang: coupangResult.data,
    period: { year, month },
    dataRange,
    warnings: [...scraperWarnings, ...validationWarnings],
  };
}
