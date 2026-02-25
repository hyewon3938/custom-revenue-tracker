import { Page } from "playwright";
import { NAVER_URLS, getFrameByUrl } from "./naver-auth";
import { selectMonthRangeAndSearch } from "./naver-datepicker";

export interface NaverSalesResult {
  totalRevenue: number;
  payerCount: number;        // 결제자수
  shippingCollected: number; // 고객이 낸 배송비 합계
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
 * 배송 건수: shippingCollected / 3,000원 = 유료배송 건수, 결제자수 - 유료배송 = 무료배송 건수
 * calcNaverShippingStats()에서 판매자 실배송비까지 계산.
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

  return {
    totalRevenue: result.totalRevenue,
    payerCount: result.payerCount,
    shippingCollected: result.shippingCollected,
  };
}
