import { Page } from "playwright";
import { PlatformFees } from "@/lib/types";
import { NAVER_URLS, getContentFrame } from "./naver-auth";
import { selectMonthRangeAndSearch } from "./naver-datepicker";

/**
 * 네이버 판매자 일별 정산내역 → 정산금·물류비·수수료·배송비·광고비 추출
 * 대상 URL: https://sell.smartstore.naver.com/#/naverpay/settlemgt/sellerdailysettle
 *
 * 이 페이지에서 수집할 항목:
 *   - 정산예정금액 (settlementAmount): 실제 입금될 금액
 *   - 네이버페이 이용료 (commissionFee): 결제 수수료
 *   - NFA 물류비 (logisticsFee): 네이버 풀필먼트 이용 시
 *   - 배송비 관련 차감 (shippingFee): 배송비 쿠폰 등
 *   - 네이버 쇼핑 광고비 (adFee): CPC 광고
 */
export async function scrapeNaverSettlement(
  page: Page,
  year: number,
  month: number
): Promise<PlatformFees> {
  await page.goto(NAVER_URLS.settlement);
  await page.waitForLoadState("networkidle");
  const frame = await getContentFrame(page);

  // ── 기간 필터: 해당 월 전체로 설정 ─────────────────────────────────
  await selectMonthRangeAndSearch(frame, year, month);
  // ────────────────────────────────────────────────────────────────────────

  // ── 정산 항목별 합계 추출 ────────────────────────────────────────────
  // TODO: 실제 DOM에서 각 항목 추출
  //
  // 예:
  // const parseMoney = async (selector: string) =>
  //   parseInt((await page.$eval(selector, el => el.textContent))?.replace(/[^\d]/g, "") ?? "0");
  //
  // const settlementAmount = await parseMoney(".total-settlement-amount");
  // const commissionFee    = await parseMoney(".naverpay-fee-total");
  // const logisticsFee     = await parseMoney(".nfa-logistics-fee-total");
  // const shippingFee      = await parseMoney(".shipping-fee-total");
  // const adFee            = await parseMoney(".ad-fee-total");
  // ────────────────────────────────────────────────────────────────────────

  return {
    settlementAmount: 0, // TODO
    logisticsFee: 0, // TODO
    commissionFee: 0, // TODO
    shippingFee: 0, // TODO
    adFee: 0, // TODO
  };
}
