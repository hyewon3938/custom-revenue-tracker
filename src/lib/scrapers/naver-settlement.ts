import { Page, Frame } from "playwright";
import { NAVER_URLS, getFrameByUrl } from "./naver-auth";
import { setDateRangeWithCalendar } from "./naver-datepicker";

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
 * 커스텀 페이지네이션에서 다음 페이지로 이동.
 * 구조: div.npay_grid_area > div.grid (테이블) 다음 형제들이 페이지 버튼.
 *   현재 페이지: <strong>N</strong> 포함, 다음 페이지: 텍스트가 숫자인 다음 형제.
 */
async function goToNextPage(frame: Frame): Promise<boolean> {
  return frame.evaluate(() => {
    const gridArea = document.querySelector("div.npay_grid_area");
    if (!gridArea) return false;

    const gridDiv = gridArea.querySelector("div.grid");
    if (!gridDiv) return false;

    // div.grid 다음 형제 중 첫 번째 DIV가 페이지네이션 컨테이너
    // (페이지가 여러 개일 때 "1 2 끝페이지" 등이 하나의 DIV 안에 묶임)
    let paginationContainer: Element | null = null;
    let sibling = gridDiv.nextElementSibling;
    while (sibling) {
      if (sibling.tagName === "DIV") { paginationContainer = sibling; break; }
      sibling = sibling.nextElementSibling;
    }
    if (!paginationContainer) return false;

    // 컨테이너 안 직접 자식 중 현재 페이지(<strong>) 찾기
    const children = Array.from(paginationContainer.children);

    // 자식이 없으면(단일 페이지 버튼이 컨테이너 자체인 경우) 컨테이너를 직접 탐색
    const searchScope = children.length > 0 ? children : [paginationContainer];

    const currentIdx = searchScope.findIndex((el) => el.querySelector("strong") || el.tagName === "STRONG");
    if (currentIdx === -1) return false;

    const nextBtn = searchScope[currentIdx + 1];
    if (!nextBtn || !/^\d+$/.test(nextBtn.textContent?.trim() ?? ""))
      return false;

    (nextBtn as HTMLElement).click();
    return true;
  });
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

  // 검색 결과 반영 대기:
  // 기본 뷰가 이미 테이블에 있어 rows > 0 만으로는 불충분.
  // 첫 번째 데이터 행의 날짜가 조회 월과 일치할 때까지 대기.
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthPrefix1 = `${year}.${pad(month)}`; // "2026.01"
  const monthPrefix2 = `${year}-${pad(month)}`; // "2026-01"
  await frame.waitForFunction(
    ({ p1, p2 }: { p1: string; p2: string }) => {
      const tables = document.querySelectorAll("table.tui-grid-table");
      const last = tables[tables.length - 1];
      if (!last) return false;
      const rows = Array.from(last.querySelectorAll("tbody tr"));
      // 데이터가 없는 달이면 행이 0개 → 로드 완료로 간주
      if (rows.length === 0) return true;
      for (const row of rows) {
        const text = row.querySelector("td")?.textContent?.trim() ?? "";
        if (/^\d{4}/.test(text)) {
          return text.startsWith(p1) || text.startsWith(p2);
        }
      }
      return false;
    },
    { p1: monthPrefix1, p2: monthPrefix2 },
    { timeout: 15_000 }
  );

  let totalSettlement = 0;
  let totalCommission = 0;
  let pageIndex = 0;

  while (true) {
    if (pageIndex > 0) {
      // 페이지 번호(<strong>)가 실제로 바뀔 때까지 대기
      const expectedPage = pageIndex + 1;
      await frame.waitForFunction(
        (expected: number) => {
          const gridArea = document.querySelector("div.npay_grid_area");
          if (!gridArea) return false;
          const strong = gridArea.querySelector("strong");
          return strong && parseInt(strong.textContent?.trim() ?? "0") === expected;
        },
        expectedPage,
        { timeout: 10_000 }
      );
    }

    const { settlementAmount, commissionFee } =
      await extractSettlementRows(frame);
    totalSettlement += settlementAmount;
    totalCommission += commissionFee;

    const hasNext = await goToNextPage(frame);
    if (!hasNext) break;
    pageIndex++;
  }

  return {
    settlementAmount: totalSettlement,
    commissionFee: Math.abs(totalCommission),
  };
}
