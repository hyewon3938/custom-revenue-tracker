/**
 * 쿠팡 판매분석 - 상품별 데이터 구조 정밀 탐색
 * STRONG(상품명) 기반으로 수량 필드 위치를 찾아냄
 *
 * 실행: npx tsx scripts/debug-coupang-sales.ts
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
    console.log("날짜 선택 완료. 5초 대기...");
    await page.waitForTimeout(5_000);

    // ── 핵심: STRONG 기반 상품 행 구조 탐색 ─────────────────────────
    const result = await page.evaluate(`
      (function() {
        var container = document.querySelector('[class*="_with-product_"]');
        if (!container) return { error: '_with-product_ 없음' };

        // 상품명 STRONG: 한글 5자 이상
        var strongs = Array.from(container.querySelectorAll('strong')).filter(function(el) {
          var txt = (el.textContent || '').trim();
          return /[가-힣]/.test(txt) && txt.replace(/\\s/g,'').length >= 5;
        });

        var samples = strongs.slice(0, 6).map(function(strong) {
          var productName = (strong.textContent || '').trim().slice(0, 50);
          var ancestor = strong;

          // STRONG에서 위로 올라가며 수량 숫자를 찾는다
          for (var depth = 0; depth < 20; depth++) {
            ancestor = ancestor.parentElement;
            if (!ancestor) break;

            // 이 subtree의 모든 리프 노드
            var leaves = Array.from(ancestor.querySelectorAll('*')).filter(function(el) {
              return el.children.length === 0 && (el.textContent || '').trim();
            });

            // 숫자(수량 후보): 쉼표 포함 1~6자리 정수, 양수
            var nums = leaves.filter(function(el) {
              var txt = (el.textContent || '').trim();
              return /^[\\d,]{1,7}$/.test(txt) && parseInt(txt.replace(/,/g,'')) > 0;
            }).map(function(el) {
              return {
                val: el.textContent.trim(),
                tag: el.tagName,
                cls: (el.getAttribute('class') || 'n/a').slice(0, 60),
              };
            });

            // 레이블: "판매량", "개" 등
            var labels = leaves
              .map(function(el) { return (el.textContent||'').trim(); })
              .filter(function(t) { return t === '판매량' || t === '개' || t.includes('개'); });

            if (nums.length >= 1 && (labels.length >= 1 || depth <= 5)) {
              return {
                name: productName,
                depth: depth,
                ancestorCls: (ancestor.getAttribute('class') || 'n/a').slice(0, 100),
                nums: nums.slice(0, 5),
                labels: labels.slice(0, 5),
              };
            }
          }
          return { name: productName, error: '수량 필드 미발견' };
        });

        // _with-product_ 직계 자식들 클래스 목록
        var directChildren = Array.from(container.children).map(function(el) {
          return {
            tag: el.tagName,
            cls: (el.getAttribute('class') || '').slice(0, 100),
            textPreview: (el.textContent || '').trim().slice(0, 60),
          };
        });

        return { strongCount: strongs.length, samples: samples, directChildren: directChildren };
      })()
    `) as {
      strongCount?: number;
      error?: string;
      samples?: { name: string; depth?: number; ancestorCls?: string; nums?: { val: string; tag: string; cls: string }[]; labels?: string[]; error?: string }[];
      directChildren?: { tag: string; cls: string; textPreview: string }[];
    };

    if (result.error) {
      console.error("❌", result.error);
    } else {
      console.log(`\n한글 STRONG(상품명 후보) ${result.strongCount}개\n`);

      console.log("── _with-product_ 직계 자식 섹션들 ───────────────────────");
      (result.directChildren || []).forEach((c, i) =>
        console.log(`  [${i}] <${c.tag}> cls="${c.cls}" | "${c.textPreview}"`)
      );

      console.log("\n── 상품명 STRONG → 수량 필드 탐색 결과 ──────────────────");
      (result.samples || []).forEach((s, i) => {
        if (s.error) {
          console.log(`\n[${i}] ${s.name}\n  ❌ ${s.error}`);
        } else {
          console.log(`\n[${i}] ${s.name}`);
          console.log(`  depth=${s.depth} | cls: ${s.ancestorCls}`);
          console.log(`  숫자 후보:`, (s.nums || []).map(n => `${n.val}(${n.tag})`).join(", "));
          console.log(`  레이블:`, (s.labels || []).join(", ") || "(없음)");
        }
      });
    }

    await page.screenshot({ path: "debug-coupang-sales.png" });
    console.log("\n스크린샷: debug-coupang-sales.png");
    console.log("\nEnter 키로 종료...");
    await new Promise<void>(resolve => {
      process.stdin.resume();
      process.stdin.once("data", () => { process.stdin.pause(); resolve(); });
    });

  } catch (e) {
    console.error("❌ 에러:", e);
    await page.screenshot({ path: "debug-coupang-error.png" }).catch(() => {});
    await page.waitForTimeout(15_000);
  } finally {
    await browser.close();
  }
})();
