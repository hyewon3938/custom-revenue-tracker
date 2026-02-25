import { Page } from "playwright";
import { ShippingStats } from "@/lib/types";
import { NAVER_URLS, getFrameByUrl } from "./naver-auth";
import { selectMonthRangeAndSearch } from "./naver-datepicker";

export interface NaverSalesResult {
  totalRevenue: number;
  payerCount: number;       // 결제자수
  shippingCollected: number; // 고객이 낸 배송비 합계
  shippingStats: ShippingStats; // 배송 건수 분석
}

/**
 * 네이버 판매분석 → 월간 총 매출 추출
 * 대상: https://sell.smartstore.naver.com/#/bizadvisor/sales
 * iframe: /biz_iframe/sales
 *
 * 확정 셀렉터:
 *   - 날짜 선택: react-datepicker (selectMonthRangeAndSearch)
 *   - 데이터 행: table.tbl_list tbody tr.total_row
 *   - td[3] = 결제자수, td[4] = 결제금액(매출), td[7] = 배송비
 *
 * 배송 건수(regularCount / freeCount)는 이 페이지에서 제공되지 않으므로 0으로 초기화.
 * 판매자 부담 배송비(sellerCost)는 정산내역에서 별도 집계됨.
 */
export async function scrapeNaverSalesAnalysis(
  page: Page,
  year: number,
  month: number
): Promise<NaverSalesResult> {
  await page.goto(NAVER_URLS.salesAnalysis);
  // accounts.commerce.naver.com 임시 인증 리다이렉트가 자동으로 완료될 때까지
  // /biz_iframe/ 프레임 탐색 (최대 45초 — 리다이렉트 왕복 포함)
  const frame = await getFrameByUrl(page, "/biz_iframe/", 45_000);

  // react-datepicker로 해당 월 1일 ~ 말일 선택 후 검색
  await selectMonthRangeAndSearch(frame, year, month);

  // 합계 행 로드 대기
  await frame.waitForSelector("table.tbl_list tbody tr.total_row", {
    timeout: 15_000,
  });

  const result = await frame.evaluate(() => {
    // 합계 행 (tr.total_row)
    const totalRow = document.querySelector("table.tbl_list tbody tr.total_row");
    if (!totalRow) return { totalRevenue: 0, payerCount: 0, shippingCollected: 0 };

    const cells = Array.from(totalRow.querySelectorAll("td"));

    return {
      totalRevenue: parseInt((cells[3]?.textContent ?? "").replace(/[^\d]/g, "")) || 0,      // [3] 결제금액
      payerCount: parseInt((cells[2]?.textContent ?? "").replace(/[^\d]/g, "")) || 0,        // [2] 결제자수
      shippingCollected: parseInt((cells[6]?.textContent ?? "").replace(/[^\d]/g, "")) || 0, // [6] 배송비
    };
  });

  const shippingStats: ShippingStats = {
    regularCount: 0,   // 상세 배송 건수는 이 페이지에서 미제공
    freeCount: 0,
    sellerCost: 0,     // 정산내역에서 집계 (logisticsFee)
  };

  return {
    totalRevenue: result.totalRevenue,
    payerCount: result.payerCount,
    shippingCollected: result.shippingCollected,
    shippingStats,
  };
}
