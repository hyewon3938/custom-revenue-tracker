import { Page, Frame } from "playwright";
import { NAVER_URLS, getFrameByUrl } from "./naver-auth";
import { setDateRangeWithCalendar } from "./naver-datepicker";
import { goToNextPageInGrid } from "./naver-utils";
import { pad } from "@/lib/utils/format";

export interface NaverSettlementResult {
  settlementAmount: number; // 정산금액 합계
  commissionFee: number;    // 수수료합계 (양수 변환)
}

/**
 * 현재 페이지의 정산 테이블에서 합계를 추출.
 * 마지막 tui-grid-table > tbody tr 순회.
 * td[2] = 정산금액, td[6] = 수수료합계
 */
async function extractSettlementRows(
  frame: Frame
): Promise<{ settlementAmount: number; commissionFee: number }> {
  return frame.evaluate(() => {
    const tables = Array.from(
      document.querySelectorAll("table.tui-grid-table")
    );
    const table = tables[tables.length - 1];
    if (!table) return { settlementAmount: 0, commissionFee: 0 };

    let settlementTotal = 0;
    let commissionTotal = 0;
    for (const row of table.querySelectorAll("tbody tr")) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 7) continue;
      const firstCell = cells[0]?.textContent?.trim() ?? "";
      if (!/^\d{4}/.test(firstCell)) continue;
      settlementTotal +=
        parseInt((cells[2]?.textContent ?? "").replace(/[^\d-]/g, "")) || 0;
      commissionTotal +=
        parseInt((cells[6]?.textContent ?? "").replace(/[^\d-]/g, "")) || 0;
    }
    return { settlementAmount: settlementTotal, commissionFee: commissionTotal };
  });
}

/**
 * 검색 결과가 조회 월 데이터로 갱신될 때까지 대기.
 * 첫 번째 데이터 행의 날짜 텍스트가 year.month 접두사와 일치하는지 확인.
 * 빈 테이블(데이터 없음 메시지 포함)은 해당 월 데이터 없음으로 간주.
 */
async function waitForMonthDataLoaded(
  frame: Frame,
  year: number,
  month: number
): Promise<void> {
  const p1 = `${year}.${pad(month)}`; // "2026.02"
  const p2 = `${year}-${pad(month)}`; // "2026-02"
  await frame.waitForFunction(
    ({ p1, p2 }: { p1: string; p2: string }) => {
      const tables = document.querySelectorAll("table.tui-grid-table");
      const last = tables[tables.length - 1];
      if (!last) return false;
      const rows = Array.from(last.querySelectorAll("tbody tr"));
      // 빈 테이블: "데이터가 없습니다" 또는 빈 상태 레이어가 보이면 로드 완료로 간주
      if (rows.length === 0) {
        // TOAST UI Grid는 데이터 없을 때 다양한 방법으로 표시:
        // .tui-grid-layer-state, .tui-grid-cell-content "데이터가 없습니다" 등
        const gridEl = last.closest(".tui-grid-container") ?? document;
        const allText = gridEl.textContent ?? "";
        return allText.includes("데이터가 없습니다") || allText.includes("조회된");
      }
      for (const row of rows) {
        const text = row.querySelector("td")?.textContent?.trim() ?? "";
        if (/^\d{4}/.test(text)) return text.startsWith(p1) || text.startsWith(p2);
      }
      return false;
    },
    { p1, p2 },
    { timeout: 15_000 }
  );
}

/** 페이지 번호(<strong>)가 expectedPage로 바뀔 때까지 대기 */
async function waitForPageChange(
  frame: Frame,
  expectedPage: number
): Promise<void> {
  await frame.waitForFunction(
    (expected: number) => {
      const gridArea = document.querySelector("div.npay_grid_area");
      if (!gridArea) return false;
      const strong = gridArea.querySelector("strong");
      return !!strong && parseInt(strong.textContent?.trim() ?? "0") === expected;
    },
    expectedPage,
    { timeout: 10_000 }
  );
}

/**
 * 네이버 판매자 일별 정산내역 → 정산금·수수료 전 페이지 합계 추출
 * 대상: https://sell.smartstore.naver.com/#/naverpay/settlemgt/sellerdailysettle
 * iframe: /e/v3/settlemgt/sellerdailysettle
 */
export async function scrapeNaverSettlement(
  page: Page,
  year: number,
  month: number
): Promise<NaverSettlementResult> {
  await page.goto(NAVER_URLS.settlement);
  const frame = await getFrameByUrl(page, "/e/v3/settlemgt/", 45_000);

  // 팝업 닫기 (없으면 무시)
  try {
    await frame.click('button.close[data-dismiss="mySmallModalLabel"]', {
      timeout: 3_000,
    });
    await frame.waitForTimeout(500);
  } catch {}

  // DateRange 캘린더 입력 필드가 렌더링될 때까지 대기
  // (이전 페이지에서 넘어올 때 iframe 초기화 지연 방지)
  await frame.waitForSelector('[data-testid*="Input::DateRange::From"]', {
    timeout: 20_000,
  });
  await frame.waitForTimeout(300);

  // readonly 인풋 클릭 → 캘린더 선택 방식
  await setDateRangeWithCalendar(frame, year, month);
  await waitForMonthDataLoaded(frame, year, month);

  // 데이터가 실제로 대상 월인지 사후 검증 (첫 행 날짜 확인)
  const expectedMonth = `${year}.${pad(month)}`;
  const firstRowDate = await frame.evaluate(({ expected }: { expected: string }) => {
    const tables = document.querySelectorAll("table.tui-grid-table");
    const last = tables[tables.length - 1];
    if (!last) return null;
    for (const row of last.querySelectorAll("tbody tr")) {
      const text = row.querySelector("td")?.textContent?.trim() ?? "";
      if (/^\d{4}/.test(text)) return text;
    }
    return null; // 행이 없음 = 해당 월 데이터 없음 (정상)
  }, { expected: expectedMonth });

  if (firstRowDate && !firstRowDate.startsWith(expectedMonth) && !firstRowDate.startsWith(`${year}-${pad(month)}`)) {
    throw new Error(
      `정산 데이터 월 불일치: 기대 ${expectedMonth}, 실제 첫 행 "${firstRowDate}"`
    );
  }

  let totalSettlement = 0;
  let totalCommission = 0;

  for (let pageIndex = 0; ; pageIndex++) {
    if (pageIndex > 0) await waitForPageChange(frame, pageIndex + 1);

    const { settlementAmount, commissionFee } = await extractSettlementRows(frame);
    totalSettlement += settlementAmount;
    totalCommission += commissionFee;

    const hasNext = await goToNextPageInGrid(frame);
    if (!hasNext) break;
  }

  return {
    settlementAmount: totalSettlement,
    commissionFee: Math.abs(totalCommission),
  };
}
