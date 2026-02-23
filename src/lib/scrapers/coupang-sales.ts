import { Page } from "playwright";
import { ProductSales } from "@/lib/types";
import { COUPANG_URLS } from "./coupang-auth";
import { detectCategory } from "./naver-orders";

export interface CoupangSalesResult {
  totalRevenue: number;
  products: ProductSales[];
}

/**
 * 쿠팡 판매분석 → 월간 매출 및 제품별 판매 데이터 추출
 * 대상 URL: https://wing.coupang.com/tenants/business-insight/sales-analysis
 *
 * 이 페이지에서 수집할 항목:
 *   - 기간별 총 매출
 *   - 상품별 판매 수량 및 매출
 */
export async function scrapeCoupangSalesAnalysis(
  page: Page,
  year: number,
  month: number
): Promise<CoupangSalesResult> {
  await page.goto(COUPANG_URLS.salesAnalysis);
  await page.waitForLoadState("networkidle");

  // ── 기간 필터: 해당 월 전체로 설정 ──────────────────────────────────
  // TODO: 실제 셀렉터 확인 후 구현
  //
  // 쿠팡 Wing 판매분석은 기간 선택 후 조회
  // const pad = (n: number) => String(n).padStart(2, "0");
  // const lastDay = new Date(year, month, 0).getDate();
  //
  // await page.click('[data-testid="date-range-input"]');
  // await page.fill('[placeholder="시작일"]', `${year}.${pad(month)}.01`);
  // await page.fill('[placeholder="종료일"]', `${year}.${pad(month)}.${pad(lastDay)}`);
  // await page.click('button:has-text("조회")');
  // await page.waitForLoadState("networkidle");
  // ────────────────────────────────────────────────────────────────────────

  // ── 총 매출 추출 ──────────────────────────────────────────────────────
  // TODO:
  // const totalRevenue = parseInt(
  //   (await page.$eval('[data-testid="total-revenue"]', el => el.textContent))
  //     ?.replace(/[^\d]/g, "") ?? "0"
  // );
  // ────────────────────────────────────────────────────────────────────────

  // ── 상품별 판매 데이터 추출 ──────────────────────────────────────────
  // TODO:
  // const products: ProductSales[] = [];
  // const rows = await page.$$(".product-sales-table tbody tr");
  // for (const row of rows) {
  //   const productName = (await row.$eval(".product-name", el => el.textContent))?.trim() ?? "";
  //   const quantity = parseInt(
  //     (await row.$eval(".sales-qty", el => el.textContent))?.replace(/[^\d]/g, "") ?? "0"
  //   );
  //   const revenue = parseInt(
  //     (await row.$eval(".sales-revenue", el => el.textContent))?.replace(/[^\d]/g, "") ?? "0"
  //   );
  //   products.push({
  //     productId: productName,
  //     productName,
  //     category: detectCategory(productName),
  //     platform: "coupang",
  //     quantity,
  //     revenue,
  //   });
  // }
  // ────────────────────────────────────────────────────────────────────────

  void year;
  void month;
  void detectCategory; // lint 방지 (TODO 구현 후 실제 사용)

  return {
    totalRevenue: 0, // TODO
    products: [], // TODO
  };
}
