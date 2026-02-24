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
 * dp__ 날짜 셀 클릭 (문자열 스크립트 사용).
 * page.click()이 <html> 포인터 이벤트 인터셉트로 실패하는 경우 대응.
 * tsx/esbuild의 __name 헬퍼 주입을 피하기 위해 문자열 형태의 evaluate 사용.
 * 동일 id가 2개(1월 overflow + 2월 패널)일 때는 마지막 요소를 클릭.
 */
async function clickDpCell(page: Page, cellId: string): Promise<void> {
  await page.evaluate(`
    (function() {
      var els = document.querySelectorAll('[id="${cellId}"]');
      if (els.length === 0) throw new Error('dp__ cell not found: ${cellId}');
      var el = els[els.length - 1];
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent("click",     { bubbles: true, cancelable: true }));
    })()
  `);
  await page.waitForTimeout(500);
}

/**
 * 쿠팡 판매분석 dp__ 캘린더를 목표 연월로 이동.
 * 이전 달 버튼: [class*="_prev_"]
 *
 * range picker는 두 달을 동시에 표시하므로
 * 목표 월 날짜 셀(id="dp-YYYY-MM-01")이 이미 DOM에 있으면 이동 불필요.
 */
async function navigateDpCalendarToMonth(
  page: Page,
  targetYear: number,
  targetMonth: number
): Promise<void> {
  const p = (n: number) => String(n).padStart(2, "0");
  const probeId = `dp-${targetYear}-${p(targetMonth)}-01`;
  const MAX = 24;

  for (let i = 0; i < MAX; i++) {
    // 목표 월 날짜 셀이 이미 달력에 보이면 이동 불필요 (2-month range picker 대응)
    const visible = await page.$(`[id="${probeId}"]`);
    if (visible) return;

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

  // 날짜 필터 트리거 클릭
  // 실제 HTML: <div class="_container_podij_1 context-trigger-filter" ...>
  //   <span>최근 7일</span><i title="calendar">
  // 페이지에 context-trigger-filter 가 여러 개 있으므로 "최근 7일" 텍스트로 특정
  await dismissPopup(page);
  try {
    await page.click('div.context-trigger-filter:has-text("최근 7일")', {
      timeout: 5_000,
    });
  } catch {
    // 이미 열려있을 수 있음 — 계속 진행
  }

  // 달력 열릴 때까지 대기
  // 실제 HTML: <div class="_calendar-header_1uc11_20"><span>2026년 1월</span></div>
  // dp__ 달력이 두 달(이전달+이번달)을 표시하므로 startId 셀이 바로 보임
  await page.waitForSelector(`[id="${startId}"]`, { timeout: 10_000 });

  // 시작일 선택 (JS evaluate 클릭 — <html> 포인터 인터셉트 우회)
  await navigateDpCalendarToMonth(page, year, month);
  await clickDpCell(page, startId);

  // 종료일 선택 (같은 달)
  await navigateDpCalendarToMonth(page, year, month);
  await clickDpCell(page, endId);

  // 확인 버튼: 'MM.DD (요일) ~ MM.DD (요일)' 선택 완료
  // 실제 HTML: <button data-wuic-props="name:btn type:primary size:l">...선택 완료</button>
  await page.click('button[data-wuic-props*="type:primary"]:has-text("선택 완료")');

  // "판매량" 리프 노드가 컨테이너에 실제로 나타날 때까지 대기
  // (waitForSelector는 기존 컨테이너를 즉시 찾으므로 데이터 로드 미확인)
  // 상품명 구조: <strong>(class=null, leaf) "제품명"
  // 판매량 구조: _label_1agud_ > span "판매량 " → leaf node
  await page.waitForFunction(
    `(function() {
      var container = document.querySelector('[class*="_container_1pewv_1"][class*="_with-product_"]');
      if (!container) return false;
      var els = container.querySelectorAll('*');
      for (var i = 0; i < els.length; i++) {
        if (els[i].children.length === 0 && (els[i].textContent || '').trim() === '판매량') return true;
      }
      return false;
    })()`,
    { timeout: 30_000 }
  );

  // 제품 데이터 + 총 매출 추출
  // 문자열 스크립트 사용 — tsx/esbuild __name 헬퍼 주입 방지
  const data = await page.evaluate(`
    (function() {
      function parseNum(text) {
        if (!text) return 0;
        return parseInt(text.replace(/,/g, '')) || 0;
      }

      var container = document.querySelector(
        '[class*="_container_1pewv_1"][class*="_with-product_"]'
      );
      if (!container) return { totalRevenue: 0, products: [] };

      var allEls = Array.from(container.querySelectorAll('*')).filter(function(el) {
        return el.children.length === 0 && (el.textContent || '').trim();
      });

      var products = [];
      var totalRevenue = 0;

      for (var i = 0; i < allEls.length; i++) {
        if ((allEls[i].textContent || '').trim() !== '판매량') continue;

        var quantity = parseNum(allEls[i - 1] ? allEls[i - 1].textContent : null);
        var revenue  = parseNum(allEls[i + 2] ? allEls[i + 2].textContent : null);
        totalRevenue += revenue;

        // 상품명: <strong> 태그를 역방향 탐색
        // 실제 구조: <p class="_common_ghzur_1 _ellipsis_dlsk5_12">
        //              <span class="" href=""><span><strong>상품명</strong>, 1개</span></span>
        //            </p>
        // "카테고리: 책갈피/북마크"보다 더 앞에 있으므로 STRONG 태그로 특정
        var productName = '';
        for (var j = i - 2; j >= Math.max(0, i - 60); j--) {
          var el  = allEls[j];
          var txt = (el.textContent || '').trim();
          if (el.tagName === 'STRONG' && /[가-힣]/.test(txt)) {
            productName = txt;
            break;
          }
        }

        if (productName && quantity > 0) {
          products.push({ productName: productName, quantity: quantity, revenue: revenue });
        }
      }

      return { totalRevenue: totalRevenue, products: products };
    })()
  `) as { totalRevenue: number; products: { productName: string; quantity: number; revenue: number }[] };

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
