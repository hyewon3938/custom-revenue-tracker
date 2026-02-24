/**
 * 쿠팡 판매분석 - 컨테이너 내 전체 리프 노드 순서 출력
 * STRONG(상품명)과 수량 사이의 실제 DOM 순서를 파악하기 위해
 * _with-product_ 컨테이너의 모든 리프 텍스트를 순서대로 출력
 *
 * 실행: npx tsx scripts/debug-coupang-sales2.ts
 */
import { chromium } from "playwright";
import { loginCoupang, COUPANG_URLS, pad } from "../src/lib/scrapers/coupang-auth";
import { getValidSessionPath } from "../src/lib/scrapers/session-store";
import { calcEndDay } from "../src/lib/scrapers/naver-datepicker";

const YEAR = 2026, MONTH = 2;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

(async () => {
  const sessionPath = await getValidSessionPath("coupang");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    userAgent: UA,
    ...(sessionPath ? { storageState: sessionPath } : {}),
  });
  const page = await ctx.newPage();

  try {
    await loginCoupang(page, ctx);
    console.log("✅ 로그인 완료");

    await page.goto(COUPANG_URLS.salesAnalysis);
    await page.waitForLoadState("load");
    await page.waitForTimeout(2_000);

    // 팝업 닫기
    for (const sel of [
      'button[data-wuic-props="name:btn size:m"]:has-text("닫기")',
      'button[data-wuic-props="name:btn size:l"]:has-text("닫기")',
    ]) {
      await page.click(sel, { timeout: 1_500 }).catch(() => {});
    }

    const endDay = calcEndDay(YEAR, MONTH);
    const startId = `dp-${YEAR}-${pad(MONTH)}-01`;
    const endId   = `dp-${YEAR}-${pad(MONTH)}-${pad(endDay)}`;

    // 날짜 선택
    await page.click('div.context-trigger-filter:has-text("최근 7일")', { timeout: 5_000 });
    await page.waitForSelector('[class*="_prev_"]', { timeout: 10_000 });

    for (let i = 0; i < 12; i++) {
      const found = await page.$(`[id="${startId}"]`);
      if (found) break;
      await page.click('[class*="_prev_"]').catch(() => {});
      await page.waitForTimeout(400);
    }

    await page.evaluate(`
      (function() {
        var start = document.querySelectorAll('[id="${startId}"]');
        var el = start[start.length - 1];
        ['mousedown','mouseup','click'].forEach(function(t) { el.dispatchEvent(new MouseEvent(t, {bubbles:true})); });
      })()
    `);
    await page.waitForTimeout(600);

    await page.evaluate(`
      (function() {
        var end = document.querySelectorAll('[id="${endId}"]');
        var el = end[0];
        ['mousedown','mouseup','click'].forEach(function(t) { el.dispatchEvent(new MouseEvent(t, {bubbles:true})); });
      })()
    `);
    await page.waitForTimeout(600);

    await page.evaluate(`
      (function() {
        var btns = Array.from(document.querySelectorAll('button'));
        var btn = btns.find(function(b) {
          return (b.getAttribute('data-wuic-props')||'').includes('type:primary') &&
                 (b.textContent||'').includes('선택 완료');
        });
        if (btn) { btn.scrollIntoView(); btn.click(); }
      })()
    `);
    console.log("날짜 선택 완료. 8초 대기...");
    await page.waitForTimeout(8_000);

    // ── 핵심: 컨테이너의 모든 리프 노드 텍스트 순서 출력 ─────────────────────────
    const result = await page.evaluate(`
      (function() {
        var container = document.querySelector('[class*="_with-product_"]');
        if (!container) return { error: '_with-product_ 없음' };

        // 방법 1: 리프 노드 순서대로 (tag, text, class)
        var allEls = Array.from(container.querySelectorAll('*'));
        var leaves = allEls.filter(function(el) {
          return el.children.length === 0 && (el.textContent || '').trim().length > 0;
        });

        var leafList = leaves.map(function(el, i) {
          var txt = (el.textContent || '').trim();
          var parentCls = (el.parentElement ? el.parentElement.getAttribute('class') || '' : '').slice(0, 80);
          var grandParentCls = (el.parentElement && el.parentElement.parentElement
            ? el.parentElement.parentElement.getAttribute('class') || '' : '').slice(0, 80);
          return {
            i: i,
            tag: el.tagName,
            txt: txt.slice(0, 60),
            parentCls: parentCls,
            gpCls: grandParentCls,
          };
        });

        // 방법 2: STRONG 태그의 depth별 조상 클래스 나열 (depth 1~8)
        var strongs = Array.from(container.querySelectorAll('strong')).filter(function(el) {
          return /[가-힣]/.test((el.textContent || '').trim());
        }).slice(0, 3);

        var strongAncestors = strongs.map(function(strong) {
          var name = (strong.textContent || '').trim().slice(0, 40);
          var ancestors = [];
          var cur = strong.parentElement;
          for (var d = 1; d <= 12 && cur; d++) {
            ancestors.push({
              depth: d,
              tag: cur.tagName,
              cls: (cur.getAttribute('class') || '').slice(0, 100),
              directChildCount: cur.children.length,
              leafCount: Array.from(cur.querySelectorAll('*')).filter(function(e) {
                return e.children.length === 0 && (e.textContent||'').trim();
              }).length,
            });
            cur = cur.parentElement;
          }
          return { name: name, ancestors: ancestors };
        });

        return {
          leafCount: leaves.length,
          leafList: leafList.slice(0, 120),  // 최대 120개
          strongAncestors: strongAncestors,
        };
      })()
    `) as {
      error?: string;
      leafCount?: number;
      leafList?: { i: number; tag: string; txt: string; parentCls: string; gpCls: string }[];
      strongAncestors?: {
        name: string;
        ancestors: { depth: number; tag: string; cls: string; directChildCount: number; leafCount: number }[];
      }[];
    };

    if (result.error) {
      console.error("❌", result.error);
    } else {
      console.log(`\n전체 리프 노드 수: ${result.leafCount}`);

      console.log("\n── STRONG 조상 클래스 목록 (depth 1~12) ───────────────────");
      (result.strongAncestors || []).forEach((s) => {
        console.log(`\n▶ "${s.name}"`);
        s.ancestors.forEach(a =>
          console.log(`  d${a.depth} <${a.tag}> childCnt=${a.directChildCount} leafCnt=${a.leafCount} | cls="${a.cls}"`)
        );
      });

      console.log("\n── 리프 노드 순서 출력 (최대 120개) ───────────────────────");
      (result.leafList || []).forEach(l => {
        const mark = /[가-힣]{5,}/.test(l.txt) && l.tag === 'STRONG' ? " ◀ STRONG 상품명" :
                     l.txt === '판매량' ? " ◀◀ 판매량 레이블" :
                     /^[\d,]+$/.test(l.txt) ? " ← 숫자" : "";
        console.log(`  [${l.i}] <${l.tag}> "${l.txt}"${mark}`);
        if (mark) {
          console.log(`        parentCls: "${l.parentCls}"`);
        }
      });
    }

    await page.screenshot({ path: "debug-coupang-sales2.png" });
    console.log("\n스크린샷: debug-coupang-sales2.png");
    console.log("\nEnter 키로 종료...");
    await new Promise<void>(resolve => {
      process.stdin.resume();
      process.stdin.once("data", () => { process.stdin.pause(); resolve(); });
    });

  } catch (e) {
    console.error("❌ 에러:", e);
    await page.screenshot({ path: "debug-coupang-error2.png" }).catch(() => {});
    await page.waitForTimeout(15_000);
  } finally {
    await browser.close();
  }
})();
