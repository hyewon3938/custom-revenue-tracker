import { Page } from "playwright";
import { PlatformFees } from "@/lib/types";
import { COUPANG_URLS } from "./coupang-auth";

/**
 * 쿠팡 로켓그로스 정산 → 정산금·물류비·수수료·배송비·광고비 추출
 * 대상 URL: https://wing.coupang.com/tenants/rfm/settlements/home
 *
 * 이 페이지에서 수집할 항목:
 *   - 정산 예정 금액 (settlementAmount): 실제 입금될 금액
 *   - 로켓그로스 물류 이용료 (logisticsFee): 입고·보관·출고·반품 비용
 *   - 판매 수수료 (commissionFee): 카테고리별 수수료율 적용
 *   - 배송비 (shippingFee): 소비자 무료배송 처리 비용
 *   - 쿠팡 광고비 (adFee): 로켓 / 일반 광고 집행 비용
 */
export async function scrapeCoupangSettlement(
  page: Page,
  year: number,
  month: number
): Promise<PlatformFees> {
  await page.goto(COUPANG_URLS.settlement);
  await page.waitForLoadState("networkidle");

  // ── 기간 필터: 해당 월 전체로 설정 ──────────────────────────────────
  // TODO: 실제 셀렉터 확인 후 구현
  //
  // const pad = (n: number) => String(n).padStart(2, "0");
  // const lastDay = new Date(year, month, 0).getDate();
  //
  // await page.click('[data-testid="settlement-period-picker"]');
  // await page.fill('[placeholder="시작일"]', `${year}-${pad(month)}-01`);
  // await page.fill('[placeholder="종료일"]', `${year}-${pad(month)}-${pad(lastDay)}`);
  // await page.click('button:has-text("조회")');
  // await page.waitForLoadState("networkidle");
  // ────────────────────────────────────────────────────────────────────────

  // ── 정산 항목별 합계 추출 ────────────────────────────────────────────
  // TODO: 실제 DOM에서 각 항목 추출
  //
  // const parseMoney = async (selector: string) =>
  //   parseInt((await page.$eval(selector, el => el.textContent))?.replace(/[^\d-]/g, "") ?? "0");
  //
  // const settlementAmount = await parseMoney('[data-testid="net-settlement-amount"]');
  // const logisticsFee     = await parseMoney('[data-testid="logistics-fee-total"]');
  // const commissionFee    = await parseMoney('[data-testid="commission-fee-total"]');
  // const shippingFee      = await parseMoney('[data-testid="shipping-fee-total"]');
  // const adFee            = await parseMoney('[data-testid="ad-fee-total"]');
  // ────────────────────────────────────────────────────────────────────────

  void year;
  void month;

  return {
    settlementAmount: 0, // TODO
    logisticsFee: 0, // TODO
    commissionFee: 0, // TODO
    shippingFee: 0, // TODO
    adFee: 0, // TODO
  };
}
