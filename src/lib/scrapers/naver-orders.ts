import { Page, Frame } from "playwright";
import { ProductSales, ProductCategory } from "@/lib/types";
import { NAVER_URLS, getContentFrame } from "./naver-auth";
import { setDateRangeWithCalendar } from "./naver-datepicker";
import { goToNextPageInGrid } from "./naver-utils";

/** 상품명으로 카테고리 자동 판별 (끈갈피 = handmade, 독서링 = other) */
export function detectCategory(productName: string): ProductCategory {
  if (productName.includes("독서링")) return "other";
  const handmadeKeywords = ["끈갈피", "북마크"];
  return handmadeKeywords.some((kw) => productName.includes(kw))
    ? "handmade"
    : "other";
}

/**
 * TOAST UI Grid에서 현재 페이지의 주문 행을 추출.
 *
 * TOAST UI Grid 구조 (확정):
 *   table.tui-grid-table (마지막) > tbody tr
 *   td[7] = 상품명, td[9] = 수량
 *   "취소"가 포함된 행은 건너뜀.
 */
async function extractOrderRows(
  frame: Frame
): Promise<{ productName: string; quantity: number }[]> {
  return frame.evaluate(() => {
    const tables = Array.from(
      document.querySelectorAll("table.tui-grid-table")
    );
    const table = tables[tables.length - 1];
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const results: { productName: string; quantity: number }[] = [];

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 10) continue;

      // 취소 주문 건너뜀 (앞 5개 셀에서 "취소" 텍스트 확인)
      const rowText = Array.from(cells)
        .slice(0, 5)
        .map((c) => c.textContent ?? "")
        .join("");
      if (rowText.includes("취소")) continue;

      const productName = cells[7]?.textContent?.trim() ?? "";
      const quantityText = cells[9]?.textContent?.trim() ?? "0";
      const quantity = parseInt(quantityText.replace(/[^\d]/g, "")) || 0;

      if (!productName || quantity <= 0) continue;
      results.push({ productName, quantity });
    }

    return results;
  });
}

/**
 * 네이버 주문통합검색 → 제품별 판매 수량 집계
 * 대상: https://sell.smartstore.naver.com/#/naverpay/manage/order
 * iframe: /o/v3/manage/order
 */
export async function scrapeNaverOrders(
  page: Page,
  year: number,
  month: number
): Promise<ProductSales[]> {
  await page.goto(NAVER_URLS.orders);
  await page.waitForLoadState("load");
  if (page.url().includes("login")) {
    throw new Error("네이버 세션이 만료되었습니다. 다시 로그인 후 수집하세요.");
  }

  const frame = await getContentFrame(page);

  // PeriodPicker React 컴포넌트가 완전히 렌더링될 때까지 대기
  // (이전 페이지에서 넘어올 때 iframe 초기화 지연 방지)
  await frame.waitForSelector('[data-testid*="Input::PeriodPicker::From"]', {
    timeout: 20_000,
  });
  await frame.waitForTimeout(500);

  // 주문통합검색 날짜 인풋은 readonly → 캘린더 클릭 방식으로 설정
  await setDateRangeWithCalendar(
    frame, year, month,
    "Input::PeriodPicker::From",
    "Input::PeriodPicker::To"
  );

  // 검색 결과 반영 대기:
  // 기본 뷰가 이미 테이블에 있으므로 waitForSelector 만으로는 불충분.
  // _listTotalCount가 갱신될 때까지 대기해야 검색 결과가 실제로 로드됨.
  await frame.waitForFunction(
    () => {
      const el = document.querySelector("b._listTotalCount, .point_color._listTotalCount");
      const n = parseInt(el?.textContent?.trim() ?? "0", 10);
      return n > 0;
    },
    { timeout: 15_000 }
  );

  // 결과 테이블 로드 대기 (추가 안전장치)
  await frame.waitForSelector("table.tui-grid-table", { timeout: 15_000 });

  const productMap = new Map<string, ProductSales>();

  // 전체 페이지 순회
  let pageIndex = 0;
  while (true) {
    if (pageIndex > 0) {
      // 페이지 전환 후 테이블 재렌더링 대기
      await frame.waitForTimeout(1_000);
    }

    const rows = await extractOrderRows(frame);
    for (const { productName, quantity } of rows) {
      if (!productMap.has(productName)) {
        productMap.set(productName, {
          productName,
          category: detectCategory(productName),
          platform: "naver",
          quantity: 0,
        });
      }
      productMap.get(productName)!.quantity += quantity;
    }

    const hasNext = await goToNextPageInGrid(frame);
    if (!hasNext) break;
    pageIndex++;
  }

  return Array.from(productMap.values());
}
