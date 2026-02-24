import { Page } from "playwright";
import { COUPANG_URLS } from "./coupang-auth";
import { calcEndDay } from "./naver-datepicker";

export interface CoupangSettlementResult {
  revenue: number;       // 매출
  logisticsFee: number;  // 풀필먼트서비스 비용 (물류비)
  commissionFee: number; // 판매수수료
  adFee: number;         // 광고비
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 쿠팡 정산 캘린더에서 현재 왼쪽 패널의 연월 읽기.
 * 헤더: div.custom-month-year-information (첫 번째 = 왼쪽 패널)
 * 텍스트 예: "2026년 2월" 또는 "2026. 2"
 */
async function readCalendarMonth(
  page: Page
): Promise<{ year: number; month: number }> {
  const text = await page.evaluate(() => {
    const headers = document.querySelectorAll(
      "div.custom-month-year-information"
    );
    return headers[0]?.textContent?.trim() ?? "";
  });

  // "2026년 2월" 또는 "2026. 2" 형식
  const match = text.match(/(\d{4})[년.\s]+(\d{1,2})/);
  if (!match) {
    throw new Error(`캘린더 헤더 파싱 실패: "${text}"`);
  }
  return { year: parseInt(match[1]), month: parseInt(match[2]) };
}

/**
 * 쿠팡 정산 캘린더를 목표 연월로 이동.
 * 네비: i[title="arrow-left"] / i[title="arrow-right"]
 */
async function navigateCalendarToMonth(
  page: Page,
  targetYear: number,
  targetMonth: number
): Promise<void> {
  const MAX = 24;
  for (let i = 0; i < MAX; i++) {
    const { year, month } = await readCalendarMonth(page);
    if (year === targetYear && month === targetMonth) return;

    const diff = (targetYear - year) * 12 + (targetMonth - month);
    if (diff > 0) {
      await page.click('i[title="arrow-right"]');
    } else {
      await page.click('i[title="arrow-left"]');
    }
    await page.waitForTimeout(400);
  }
  throw new Error(
    `정산 캘린더 이동 실패: ${targetYear}년 ${targetMonth}월`
  );
}

/**
 * 쿠팡 로켓그로스 정산 → 매출·물류비·수수료·광고비 추출
 * 대상: https://wing.coupang.com/tenants/rfm/settlements/home
 *
 * 확정 셀렉터:
 *   - 날짜 버튼: button.custom-selection (활성 시 is--activated)
 *   - 캘린더 네비: i[title="arrow-left"] / i[title="arrow-right"]
 *   - 날짜 셀: [id="YYYY-MM-DD"]
 *   - 완료 버튼: button:has-text("완료")
 *   - 매출: dd.profit-detail-desc (첫 번째, "+ 1,134,500" 형식)
 *   - 비용: dd.profit-detail-more 텍스트에서 정규식으로 파싱
 */
export async function scrapeCoupangSettlement(
  page: Page,
  year: number,
  month: number
): Promise<CoupangSettlementResult> {
  await page.goto(COUPANG_URLS.settlement);
  await page.waitForLoadState("load");
  if (page.url().includes("/login")) {
    throw new Error("쿠팡 세션이 만료되었습니다. 다시 로그인 후 수집하세요.");
  }

  const endDay = calcEndDay(year, month);
  const startId = `${year}-${pad(month)}-01`;
  const endId = `${year}-${pad(month)}-${pad(endDay)}`;

  // 날짜 범위 선택 버튼 클릭
  await page.click("button.custom-selection");
  await page.waitForSelector(`[id="${startId}"]`, { timeout: 8_000 });

  // 시작월로 이동 후 시작일 클릭
  await navigateCalendarToMonth(page, year, month);
  await page.click(`[id="${startId}"]`);

  // 종료일: 같은 달이므로 캘린더 재이동 불필요
  // (2-panel 캘린더에서 end date가 다른 패널에 있을 수 있으므로 재탐색)
  await navigateCalendarToMonth(page, year, month);
  await page.click(`[id="${endId}"]`);

  // 완료 버튼 (networkidle 없이 — SPA라 idle이 오지 않을 수 있음)
  await page.click('button:has-text("완료")');

  // 데이터 컨테이너 로드 대기
  await page.waitForSelector("dd.profit-detail-desc", { timeout: 15_000 });

  // 재무 데이터 추출
  // 문자열 스크립트 사용 — tsx/esbuild __name 헬퍼 주입 방지
  const data = await page.evaluate(`
    (function() {
      function parsePlus(text) {
        if (!text) return 0;
        return parseInt(text.replace(/[^\\d]/g, '')) || 0;
      }
      function parseMinus(text, pattern) {
        if (!text) return 0;
        var m = pattern.exec(text);
        if (!m) return 0;
        return parseInt(m[1].replace(/,/g, '')) || 0;
      }

      var revenueEl = document.querySelector('dd.profit-detail-desc');
      var revenue = parsePlus(revenueEl ? revenueEl.textContent : null);

      var moreText = Array.from(document.querySelectorAll('dd.profit-detail-more'))
        .map(function(el) { return el.textContent || ''; })
        .join(' ');

      var logisticsFee = parseMinus(moreText, /풀필먼트서비스\\s*비용\\s*-\\s*([\\d,]+)/);
      var adFee        = parseMinus(moreText, /광고비\\s*-\\s*([\\d,]+)/);
      var commissionFee = parseMinus(moreText, /판매수수료\\s*-\\s*([\\d,]+)/);

      return { revenue: revenue, logisticsFee: logisticsFee, adFee: adFee, commissionFee: commissionFee };
    })()
  `) as { revenue: number; logisticsFee: number; adFee: number; commissionFee: number };

  return data;
}
