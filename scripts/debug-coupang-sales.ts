/**
 * 쿠팡 판매분석 날짜 선택 & 데이터 추출 디버그
 * 실행: npx tsx scripts/debug-coupang-sales.ts
 */
import { chromium } from "playwright";
import { loginCoupang, COUPANG_URLS } from "../src/lib/scrapers/coupang-auth";
import { calcEndDay } from "../src/lib/scrapers/naver-datepicker";

const YEAR = 2026, MONTH = 2;
const pad = (n: number) => String(n).padStart(2, "0");

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  try {
    await loginCoupang(page);
    console.log("✅ 로그인 완료\n");

    await page.goto(COUPANG_URLS.salesAnalysis);
    await page.waitForLoadState("load");

    // 팝업 닫기
    for (const sel of [
      'button[data-wuic-props="name:btn size:m"]:has-text("닫기")',
      'button[data-wuic-props="name:btn size:l"]:has-text("닫기")',
    ]) {
      try { await page.click(sel, { timeout: 1_500 }); await page.waitForTimeout(300); } catch {}
    }

    const endDay = calcEndDay(YEAR, MONTH);
    const startId = `dp-${YEAR}-${pad(MONTH)}-01`;
    const endId   = `dp-${YEAR}-${pad(MONTH)}-${pad(endDay)}`;
    console.log(`날짜: ${startId} ~ ${endId}`);

    // 트리거 클릭
    await page.click('div.context-trigger-filter:has-text("최근 7일")', { timeout: 5_000 });
    await page.waitForSelector(`[id="${startId}"]`, { timeout: 10_000 });

    // 시작일 클릭
    await page.evaluate(`
      (function() {
        var els = document.querySelectorAll('[id="${startId}"]');
        var el = els[els.length - 1];
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true }));
        el.dispatchEvent(new MouseEvent("click",     { bubbles: true }));
      })()
    `);
    await page.waitForTimeout(500);

    // 종료일 클릭
    await page.evaluate(`
      (function() {
        var els = document.querySelectorAll('[id="${endId}"]');
        var el = els[els.length - 1];
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true }));
        el.dispatchEvent(new MouseEvent("click",     { bubbles: true }));
      })()
    `);
    await page.waitForTimeout(500);

    // 확인 버튼 클릭
    await page.click('button[data-wuic-props*="type:primary"]:has-text("선택 완료")');
    console.log("확인 버튼 클릭 완료");

    // 3초 대기 (데이터 로드)
    await page.waitForTimeout(3_000);

    // ── 데이터 추출 로직 테스트 ──
    const result = await page.evaluate(`
      (function() {
        function parseNum(text) {
          if (!text) return 0;
          return parseInt(text.replace(/,/g, '')) || 0;
        }

        var container = document.querySelector(
          '[class*="_container_1pewv_1"][class*="_with-product_"]'
        );
        if (!container) return { error: 'container not found', totalRevenue: 0, products: [] };

        var allEls = Array.from(container.querySelectorAll('*')).filter(function(el) {
          return el.children.length === 0 && (el.textContent || '').trim();
        });

        console.log('[debug] 리프 요소 수:', allEls.length);

        // "판매량" 찾기
        var salesLabelIndices = [];
        for (var i = 0; i < allEls.length; i++) {
          var t = (allEls[i].textContent || '').trim();
          if (t === '판매량') salesLabelIndices.push(i);
        }
        console.log('[debug] "판매량" 리프 인덱스:', salesLabelIndices);

        // 샘플: 첫 번째 "판매량" 주변 요소 출력
        if (salesLabelIndices.length > 0) {
          var idx = salesLabelIndices[0];
          var sample = [];
          for (var k = Math.max(0, idx - 5); k <= Math.min(allEls.length - 1, idx + 5); k++) {
            sample.push({ i: k, text: (allEls[k].textContent || '').trim().slice(0, 30), cls: (allEls[k].getAttribute('class') || '').slice(0, 40) });
          }
          console.log('[debug] 판매량 주변 요소:', JSON.stringify(sample));
        }

        var products = [];
        var totalRevenue = 0;

        for (var i = 0; i < allEls.length; i++) {
          if ((allEls[i].textContent || '').trim() !== '판매량') continue;

          var quantity = parseNum(allEls[i - 1] ? allEls[i - 1].textContent : null);
          var revenue  = parseNum(allEls[i + 2] ? allEls[i + 2].textContent : null);
          totalRevenue += revenue;

          var productName = '';
          for (var j = i - 2; j >= Math.max(0, i - 30); j--) {
            var el  = allEls[j];
            var cls = el.getAttribute('class');
            var txt = (el.textContent || '').trim();
            if ((cls === null || cls === '') && /[가-힣]/.test(txt) && txt.length > 1) {
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
    `);

    console.log("\n추출 결과:");
    console.log(JSON.stringify(result, null, 2));

    console.log("\n10초 후 종료...");
    await page.waitForTimeout(10_000);
  } catch (e) {
    console.error("❌ 에러:", e);
    await page.waitForTimeout(10_000);
  } finally {
    await browser.close();
  }
})();
