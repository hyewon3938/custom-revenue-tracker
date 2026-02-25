import { Page } from "playwright";
import { ProductSales } from "@/lib/types";
import { COUPANG_URLS, pad } from "./coupang-auth";
import { detectCategory } from "@/lib/calculations/profit";
import { calcEndDay } from "./naver-datepicker";

export interface CoupangSalesResult {
  totalRevenue: number;
  products: ProductSales[];
}

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
  // 문자열 스크립트 사용 — tsx/esbuild __name 헬퍼 주입 방지
  // 실제 HTML: <div class="_calendar-header_1uc11_20"><span>2026년 1월</span></div>
  const text = await page.evaluate(`
    (function() {
      var headers = document.querySelectorAll('[class*="_calendar-header_"]');
      if (headers.length === 0) return '';
      var spans = Array.from(headers[0].querySelectorAll('span'));
      for (var i = 0; i < spans.length; i++) {
        var t = (spans[i].textContent || '').trim();
        if (/\\d{4}[년\\s]|\\d{4}/.test(t)) return t;
      }
      return (headers[0].textContent || '').trim();
    })()
  `) as string;

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
 * dp__ 날짜 셀 클릭 (JS evaluate — <html> 포인터 인터셉트 우회).
 * 2-month range picker에서 동일 id가 두 패널에 중복 존재하는 경우 대응:
 *   useLast=true  → 마지막 요소: 첫째 날 (이전 패널 overflow는 els[0], 실제 셀은 마지막)
 *   useLast=false → 첫 번째 요소: 말일 (다음 패널 overflow가 마지막, 실제 셀은 첫 번째)
 */
async function clickDpCell(page: Page, cellId: string, useLast = true): Promise<void> {
  const elPicker = useLast ? 'els[els.length - 1]' : 'els[0]';
  await page.evaluate(`
    (function() {
      var els = document.querySelectorAll('[id="${cellId}"]');
      if (els.length === 0) throw new Error('dp__ cell not found: ${cellId}');
      var el = ${elPicker};
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
  const probeId = `dp-${targetYear}-${pad(targetMonth)}-01`;
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

  const endDay = calcEndDay(year, month);
  const startId = `dp-${year}-${pad(month)}-01`;
  const endId = `dp-${year}-${pad(month)}-${pad(endDay)}`;

  // 팝업 닫기 후 날짜 필터 트리거 클릭
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

  // 달력이 열릴 때까지 대기
  // 이전 달 버튼([class*="_prev_"])이 나타나면 달력이 렌더링된 것으로 판단
  // startId로 대기하면 과거 달은 아직 보이지 않아 타임아웃 발생
  await page.waitForSelector('[class*="_prev_"]', { timeout: 10_000 });

  // 시작일 선택 (JS evaluate 클릭 — <html> 포인터 인터셉트 우회)
  await navigateDpCalendarToMonth(page, year, month);
  await clickDpCell(page, startId);

  // 종료일 선택 (같은 달) — els[0]: 말일은 다음 패널 overflow에 중복 존재하므로 첫 번째가 실제 셀
  await navigateDpCalendarToMonth(page, year, month);
  await clickDpCell(page, endId, false);

  // 확인 버튼 (JS evaluate — viewport 외부 요소 대응)
  await page.evaluate(`
    (function() {
      var btns = Array.from(document.querySelectorAll('button'));
      var btn = null;
      for (var i = 0; i < btns.length; i++) {
        if ((btns[i].getAttribute('data-wuic-props') || '').indexOf('type:primary') !== -1 &&
            (btns[i].textContent || '').trim().indexOf('선택 완료') !== -1) {
          btn = btns[i];
          break;
        }
      }
      if (!btn) throw new Error('선택 완료 버튼 없음');
      btn.scrollIntoView();
      btn.click();
    })()
  `);

  // 상품 리스트의 판매량 레이블(_label_1agud_)이 나타날 때까지 대기.
  // _label_1agud_ 조건을 추가해 차트 섹션 "판매량" 토글 버튼 오탐 방지.
  //
  // 확정 리프 노드 순서 (상품 1행 기준):
  //   STRONG "상품명"
  //   A      "등록상품 ID ∙ 옵션 ID"
  //   SPAN   "책갈피/북마크" (카테고리)
  //   SPAN   "상품 상태" / "광고 중지" / "외 N개" (선택)
  //   SPAN   숫자("방문자") SPAN "방문자" SPAN %
  //   SPAN   숫자("조회")   SPAN "조회"   SPAN %
  //   SPAN   숫자("장바구니") SPAN "장바구니" SPAN %
  //   SPAN   숫자("주문")   SPAN "주문"   SPAN %
  //   SPAN   [수량]          ← allEls[i-1]  parentCls: _value_1agud_
  //   SPAN   "판매량"        ← allEls[i]    parentCls: _label_1agud_  ← 여기로 판별
  //   SPAN   %              ← allEls[i+1]
  //   SPAN   [매출]          ← allEls[i+2]  parentCls: _value_1agud_
  //   SPAN   "매출 (원)"
  //   ...
  //   SPAN   "로켓그로스"
  await page.waitForFunction(
    `(function() {
      var container = document.querySelector('[class*="_container_1pewv_1"][class*="_with-product_"]');
      if (!container) return false;
      var els = container.querySelectorAll('*');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.children.length === 0 && (el.textContent || '').trim() === '판매량') {
          var parentCls = (el.parentElement ? el.parentElement.getAttribute('class') || '' : '');
          if (parentCls.includes('_label_1agud_')) return true;
        }
      }
      return false;
    })()`,
    { timeout: 30_000 }
  );

  // 제품 데이터 + 총 매출 추출 (문자열 스크립트 — tsx/esbuild __name 헬퍼 주입 방지)
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
        var el = allEls[i];
        if ((el.textContent || '').trim() !== '판매량') continue;

        // 차트 섹션 오탐 방지: 상품 리스트 판매량 레이블(_label_1agud_)만 처리
        var parentCls = (el.parentElement ? el.parentElement.getAttribute('class') || '' : '');
        if (!parentCls.includes('_label_1agud_')) continue;

        // i-1: 판매량 수치, i+1: 전기 대비 %, i+2: 매출 수치
        var quantity = parseNum(allEls[i - 1] ? allEls[i - 1].textContent : null);
        var revenue  = parseNum(allEls[i + 2] ? allEls[i + 2].textContent : null);
        totalRevenue += revenue;

        // 상품명: 현재 위치에서 역방향으로 STRONG(한글) 탐색
        // 개별 상품 행은 STRONG → 각종 메트릭 → 판매량 순서이므로
        // 최대 60 리프 노드 이내에 반드시 해당 상품의 STRONG이 존재
        var productName = '';
        for (var j = i - 2; j >= Math.max(0, i - 60); j--) {
          var sEl = allEls[j];
          var txt = (sEl.textContent || '').trim();
          if (sEl.tagName === 'STRONG' && /[가-힣]/.test(txt)) {
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
