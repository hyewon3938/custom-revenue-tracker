import { Page } from "playwright";
import { NAVER_URLS } from "./naver-auth";

export interface NaverSalesResult {
  totalRevenue: number;
}

/**
 * 네이버 판매분석 → 월간 총 매출 추출
 * 대상 URL: https://sell.smartstore.naver.com/#/bizadvisor/sales
 *
 * 판매분석 > 매출현황 탭에서 해당 월 전체 매출을 확인할 수 있음.
 */
export async function scrapeNaverSalesAnalysis(
  page: Page,
  year: number,
  month: number
): Promise<NaverSalesResult> {
  await page.goto(NAVER_URLS.salesAnalysis);
  await page.waitForLoadState("networkidle");

  // ── 기간 필터: 해당 월 전체로 설정 ──────────────────────────────────
  // TODO: 실제 셀렉터 확인 후 구현
  //
  // 예: 월별 탭 선택
  // await page.click('button:has-text("월별")');
  //
  // 예: 연/월 선택 드롭다운
  // await page.selectOption('[data-testid="year-select"]', String(year));
  // await page.selectOption('[data-testid="month-select"]', String(month));
  // await page.click('button:has-text("조회")');
  // await page.waitForLoadState("networkidle");
  // ────────────────────────────────────────────────────────────────────────

  // ── 총 매출 추출 ──────────────────────────────────────────────────────
  // TODO: 실제 DOM에서 매출 합계 추출
  //
  // 예:
  // const totalRevenue = parseInt(
  //   (await page.$eval(
  //     '[data-testid="total-sales-revenue"]',
  //     (el) => el.textContent
  //   ))?.replace(/[^\d]/g, "") ?? "0"
  // );
  // ────────────────────────────────────────────────────────────────────────

  void year;
  void month;

  return {
    totalRevenue: 0, // TODO: 실제 값으로 교체
  };
}
