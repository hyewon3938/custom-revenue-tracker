import { Page } from "playwright";
import { ProductSales } from "@/lib/types";
import { COUPANG_URLS } from "./coupang-auth";
import { detectCategory } from "./naver-orders";
import { calcEndDay } from "./naver-datepicker";

export interface CoupangSalesResult {
  totalRevenue: number;
  products: ProductSales[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 쿠팡 팝업 닫기.
 * - 홈 진입 팝업:       button[data-wuic-props="name:btn size:m"]:has-text("닫기")
 * - 판매분석 팝업:       button[data-wuic-props="name:btn size:l"]:has-text("닫기")
 */
async function dismissPopup(page: Page): Promise<void> {
  const selectors = [
    'button[data-wuic-props="name:btn size:m"]:has-text("닫기")',
    'button[data-wuic-props="name:btn size:l"]:has-text("닫기")',
  ];
  for (const sel of selectors) {
    try {
      await page.click(sel, { timeout: 1_500 });
      await page.waitForTimeout(300);
    } catch {
      // 해당 팝업 없음
    }
  }
}

/**
 * 쿠팡 판매분석 dp__ 캘린더에서 현재 표시 중인 연월 읽기.
 * 헤더: [class*="_calendar-header_"] > span (첫 번째 패널)
 * 텍스트 예: "2026년 2월" 또는 "February 2026"
 */
async function readDpCalendarMonth(
  page: Page
): Promise<{ year: number; month: number }> {
  const text = await page.evaluate(() => {
    const span = document.querySelector(
      '[class*="_calendar-header_"] span, .dp__calendar_header_item'
    );
    // dp__main 내부의 월/년 표시 텍스트를 찾음
    const headers = Array.from(
      document.querySelectorAll('[class*="_calendar-header_"]')
    );
    if (headers.length === 0) return "";
    const spans = Array.from(headers[0].querySelectorAll("span"));
    const found = spans.find((s) =>
      /\d{4}[년\s]|\d{4}/.test(s.textContent ?? "")
    );
    return found?.textContent?.trim() ?? span?.textContent?.trim() ?? "";
  });

  const match = text.match(/(\d{4})[년.\s]+(\d{1,2})/) ??
    text.match(/(\d{1,2})[월.\s]+(\d{4})/);
  if (!match) {
    throw new Error(`dp__ 캘린더 헤더 파싱 실패: "${text}"`);
  }

  // "YYYY년 MM" vs "MM월 YYYY" 판별
  const a = parseInt(match[1]);
  const b = parseInt(match[2]);
  if (a > 100) {
    return { year: a, month: b };
  } else {
    return { year: b, month: a };
  }
}

/**
 * 쿠팡 판매분석 dp__ 캘린더를 목표 연월로 이동.
 * 이전 달 버튼: [class*="_prev_"]
 */
async function navigateDpCalendarToMonth(
  page: Page,
  targetYear: number,
  targetMonth: number
): Promise<void> {
  const MAX = 24;
  for (let i = 0; i < MAX; i++) {
    const { year, month } = await readDpCalendarMonth(page);
    if (year === targetYear && month === targetMonth) return;

    const diff = (targetYear - year) * 12 + (targetMonth - month);
    if (diff < 0) {
      // 이전 달로 이동
      await page.click('[class*="_prev_"]');
    } else {
      // 다음 달은 dp__ 캘린더에 별도 next 버튼 없음 → 반대로 이동 불가 시 예외
      // 실제로 next 버튼도 존재하는 경우: [class*="_next_"]
      const hasNext = await page.$('[class*="_next_"]');
      if (hasNext) {
        await page.click('[class*="_next_"]');
      } else {
        throw new Error(`dp__ 캘린더 다음 달 버튼 없음 (diff=${diff})`);
      }
    }
    await page.waitForTimeout(400);
  }
  throw new Error(
    `dp__ 캘린더 이동 실패: ${targetYear}년 ${targetMonth}월`
  );
}

/**
 * 쿠팡 판매분석 → 월간 매출 및 제품별 판매 데이터 추출
 * 대상: https://wing.coupang.com/tenants/business-insight/sales-analysis
 *
 * 확정 셀렉터:
 *   - 날짜 필터 트리거: 페이지 상단의 날짜 범위 표시 버튼 (클릭 시 .dp__main 열림)
 *   - 달력 네비: [class*="_prev_"] (이전달), [class*="_next_"] (다음달)
 *   - 날짜 셀: [id="dp-YYYY-MM-DD"]
 *   - 확인 버튼: button:has-text("선택 완료")
 *   - 제품 컨테이너: [class*="_container_1pewv_1"][class*="_with-product_"]
 *   - 제품 추출: 텍스트 노드 순회 → "판매량" 레이블 이전 값 = 수량, i+2 = 매출
 */
export async function scrapeCoupangSalesAnalysis(
  page: Page,
  year: number,
  month: number
): Promise<CoupangSalesResult> {
  await page.goto(COUPANG_URLS.salesAnalysis);
  await page.waitForLoadState("load");
  if (page.url().includes("/login")) {
    throw new Error("쿠팡 세션이 만료되었습니다. 다시 로그인 후 수집하세요.");
  }

  // 초기 팝업 닫기
  await dismissPopup(page);

  const endDay = calcEndDay(year, month);
  const startId = `dp-${year}-${pad(month)}-01`;
  const endId = `dp-${year}-${pad(month)}-${pad(endDay)}`;

  // 날짜 필터 트리거 클릭 — 팝업이 다시 뜰 수 있으므로 닫은 뒤 클릭
  await dismissPopup(page);
  const triggerSelectors = [
    '[class*="_date-range-picker_"]',
    '[class*="date-range-trigger"]',
    '[class*="date-filter"]',
  ];
  let triggered = false;
  for (const sel of triggerSelectors) {
    try {
      await page.click(sel, { timeout: 2_000 });
      triggered = true;
      break;
    } catch {
      // 다음 셀렉터 시도
    }
  }
  if (!triggered) {
    // fallback: "최근 7일" 텍스트로 트리거
    try {
      await page.click(':text("최근 7일")', { timeout: 2_000 });
    } catch {
      // 이미 열려있을 수 있음 — 계속 진행
    }
  }

  // 달력 열릴 때까지 대기 (팝업이 다시 나타났으면 먼저 닫기)
  await dismissPopup(page);
  await page.waitForSelector(`[id="${startId}"]`, { timeout: 10_000 });

  // 시작일 선택
  await navigateDpCalendarToMonth(page, year, month);
  await page.click(`[id="${startId}"]`);

  // 종료일 선택 (같은 달)
  await navigateDpCalendarToMonth(page, year, month);
  await page.click(`[id="${endId}"]`);

  // 확인 버튼 ("MM.DD ~ MM.DD' 선택 완료" 형식)
  await page.click('button:has-text("선택 완료")');
  await page.waitForLoadState("networkidle");

  // 제품 컨테이너 로드 대기
  await page.waitForSelector(
    '[class*="_container_1pewv_1"][class*="_with-product_"]',
    { timeout: 15_000 }
  );

  // 제품 데이터 + 총 매출 추출
  const data = await page.evaluate(() => {
    const parseNum = (text: string | null | undefined): number => {
      if (!text) return 0;
      return parseInt(text.replace(/,/g, "")) || 0;
    };

    const container = document.querySelector(
      '[class*="_container_1pewv_1"][class*="_with-product_"]'
    );
    if (!container) return { totalRevenue: 0, products: [] };

    // 모든 리프 텍스트 노드 수집
    const allEls = Array.from(container.querySelectorAll("*")).filter(
      (el) => el.children.length === 0 && (el.textContent?.trim() ?? "")
    );

    const products: { productName: string; quantity: number; revenue: number }[] = [];
    let totalRevenue = 0;

    for (let i = 0; i < allEls.length; i++) {
      if (allEls[i].textContent?.trim() !== "판매량") continue;

      // 수량: "판매량" 바로 앞 요소
      const quantity = parseNum(allEls[i - 1]?.textContent);

      // 매출: "판매량" 이후 2번째 요소 (판매량 → % → 매출액)
      const revenue = parseNum(allEls[i + 2]?.textContent);
      totalRevenue += revenue;

      // 상품명: "판매량" 앞에서 class 없는 한글 텍스트 요소를 역방향 탐색
      let productName = "";
      for (let j = i - 2; j >= Math.max(0, i - 30); j--) {
        const el = allEls[j];
        const cls = el.getAttribute("class");
        const text = el.textContent?.trim() ?? "";
        if ((cls === null || cls === "") && /[가-힣]/.test(text) && text.length > 1) {
          productName = text;
          break;
        }
      }

      if (productName && quantity > 0) {
        products.push({ productName, quantity, revenue });
      }
    }

    return { totalRevenue, products };
  });

  const productSales: ProductSales[] = data.products.map((p) => ({
    productName: p.productName,
    category: detectCategory(p.productName),
    platform: "coupang" as const,
    quantity: p.quantity,
  }));

  return {
    totalRevenue: data.totalRevenue,
    products: productSales,
  };
}
