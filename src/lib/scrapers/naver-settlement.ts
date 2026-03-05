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
 * 마지막 tui-grid-table 헤더를 읽어 "정산금액" / "수수료합계" 컬럼 인덱스를 동적으로 결정.
 * 고정 인덱스(td[2], td[6])는 네이버 컬럼 순서 변경 시 깨지므로 헤더 기반으로 교체.
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

    // 헤더 컬럼 인덱스를 동적으로 파악
    // TOAST UI Grid는 thead가 별도 table일 수 있으므로 컨테이너 내 첫 번째 table에서 헤더를 읽음
    const container = table.closest(".tui-grid-container");
    const headerCells = Array.from(
      (container ?? document).querySelectorAll("table.tui-grid-table thead th")
    );
    let settlementIdx = 2; // fallback
    let commissionIdx = 6; // fallback
    headerCells.forEach((th, i) => {
      const text = th.textContent?.trim() ?? "";
      if (text.includes("정산금액")) settlementIdx = i;
      if (text.includes("수수료합계") || text.includes("수수료 합계")) commissionIdx = i;
    });

    let settlementTotal = 0;
    let commissionTotal = 0;
    for (const row of table.querySelectorAll("tbody tr")) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 3) continue;
      const firstCell = cells[0]?.textContent?.trim() ?? "";
      if (!/^\d{4}/.test(firstCell)) continue;
      settlementTotal +=
        parseInt((cells[settlementIdx]?.textContent ?? "").replace(/[^\d-]/g, "")) || 0;
      commissionTotal +=
        parseInt((cells[commissionIdx]?.textContent ?? "").replace(/[^\d-]/g, "")) || 0;
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
        // TOAST UI Grid 빈 상태: "데이터가 없습니다" 메시지 또는 빈 상태 레이어만 확인.
        // "조회된" 같은 광범위한 텍스트는 로딩 중에도 나타날 수 있어 false positive 유발 → 제거.
        const gridEl = last.closest(".tui-grid-container") ?? document;
        return (
          !!gridEl.querySelector(".tui-grid-layer-state") ||
          (gridEl.textContent ?? "").includes("데이터가 없습니다")
        );
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

  // 검색 버튼 클릭 후 TOAST UI Grid가 렌더링 완료될 때까지 짧게 대기.
  // networkidle 이후에도 JS 기반 그리드는 비동기로 데이터를 렌더링할 수 있음.
  await frame.waitForTimeout(800);

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
