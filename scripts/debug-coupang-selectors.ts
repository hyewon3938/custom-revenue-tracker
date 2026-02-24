/**
 * 쿠팡 판매분석/정산 페이지 셀렉터 확인 스크립트
 * 실행: npx tsx scripts/debug-coupang-selectors.ts
 */
import { chromium, Page } from "playwright";
import * as path from "path";
import { loginCoupang, COUPANG_URLS } from "../src/lib/scrapers/coupang-auth";

const pad = (n: number) => String(n).padStart(2, "0");

async function probePage(page: Page, label: string) {
  const screenshotPath = path.join(process.cwd(), "scripts", `screenshot-${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`  📸 스크린샷: ${screenshotPath}`);

  const info = await page.evaluate(() => {
    const check = (sel: string) => !!document.querySelector(sel);
    const count = (sel: string) => document.querySelectorAll(sel).length;
    const text = (sel: string) => document.querySelector(sel)?.textContent?.trim().slice(0, 80) ?? "(없음)";
    return {
      // 쿠팡 정산 캘린더
      "button.custom-selection": check("button.custom-selection"),
      // 쿠팡 판매분석 날짜 트리거
      "[class*='_date-range-picker_']": check("[class*='_date-range-picker_']"),
      "[class*='date-range-trigger']": check("[class*='date-range-trigger']"),
      ":text('최근 7일')": document.body.textContent?.includes("최근 7일") ?? false,
      // 날짜 셀
      "[id='dp-2026-02-01']": check("[id='dp-2026-02-01']"),
      "[id='2026-02-01']": check("[id='2026-02-01']"),
      // 수익 정보
      "dd.profit-detail-desc count": count("dd.profit-detail-desc"),
      "dd.profit-detail-desc text": text("dd.profit-detail-desc"),
      // 제품 컨테이너
      "[class*='_container_1pewv_1']": check("[class*='_container_1pewv_1']"),
      "[class*='_with-product_']": check("[class*='_with-product_']"),
      // 달력 관련
      "div.custom-month-year-information": check("div.custom-month-year-information"),
      ".dp__main": check(".dp__main"),
      // 버튼
      "button:contains '완료'": Array.from(document.querySelectorAll("button")).filter(b => b.textContent?.includes("완료")).map(b => b.textContent?.trim()).slice(0, 3),
      "button:contains '선택 완료'": Array.from(document.querySelectorAll("button")).filter(b => b.textContent?.includes("선택 완료")).map(b => b.textContent?.trim()).slice(0, 3),
      // 전체 주요 텍스트 버튼 목록 (첫 10개)
      "all buttons": Array.from(document.querySelectorAll("button")).map(b => b.textContent?.trim()).filter(Boolean).slice(0, 15),
    };
  });

  console.log("  셀렉터 체크:");
  for (const [key, val] of Object.entries(info)) {
    console.log(`    ${key}: ${JSON.stringify(val)}`);
  }
}

(async () => {
  const year = 2026, month = 2;
  const endDay = Math.min(new Date().getDate() - 1, 22); // 어제 or 22

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await loginCoupang(page);
    console.log("✅ 로그인 완료:", page.url());

    // ── 판매분석 ──────────────────────────────────────────────
    console.log("\n\n=== 쿠팡 판매분석 ===");
    await page.goto(COUPANG_URLS.salesAnalysis);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);
    await probePage(page, "coupang-sales-before-click");

    // 날짜 트리거 클릭 시도
    const triggerSelectors = [
      '[class*="_date-range-picker_"]',
      '[class*="date-range-trigger"]',
      '[class*="date-filter"]',
    ];
    let triggered = false;
    for (const sel of triggerSelectors) {
      try {
        await page.click(sel, { timeout: 2_000 });
        console.log(`  ✅ 날짜 트리거 클릭 성공: ${sel}`);
        triggered = true;
        break;
      } catch {
        console.log(`  ❌ ${sel} 없음`);
      }
    }
    if (!triggered) {
      // '최근 7일' 버튼 클릭 시도
      try {
        await page.click(':text("최근 7일")', { timeout: 2_000 });
        console.log("  ✅ '최근 7일' 버튼 클릭");
        triggered = true;
      } catch {
        console.log("  ❌ '최근 7일' 버튼 없음");
      }
    }

    if (triggered) {
      await page.waitForTimeout(1500);
      await probePage(page, "coupang-sales-after-trigger");

      // dp- ID 형식 날짜 셀 확인
      const startId = `dp-${year}-${pad(month)}-01`;
      const endId = `dp-${year}-${pad(month)}-${pad(endDay)}`;
      const hasStart = await page.$(`[id="${startId}"]`);
      const hasEnd = await page.$(`[id="${endId}"]`);
      console.log(`  날짜셀 [id="${startId}"]: ${hasStart ? "✅" : "❌"}`);
      console.log(`  날짜셀 [id="${endId}"]: ${hasEnd ? "✅" : "❌"}`);
    }

    // ── 정산 ──────────────────────────────────────────────────
    console.log("\n\n=== 쿠팡 정산 ===");
    await page.goto(COUPANG_URLS.settlement);
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);
    await probePage(page, "coupang-settlement-before-click");

    // button.custom-selection 클릭 시도
    const hasCustomSel = await page.$("button.custom-selection");
    if (hasCustomSel) {
      await page.click("button.custom-selection");
      await page.waitForTimeout(1500);
      await probePage(page, "coupang-settlement-after-trigger");

      const startId = `${year}-${pad(month)}-01`;
      const endId = `${year}-${pad(month)}-${pad(endDay)}`;
      const hasStart = await page.$(`[id="${startId}"]`);
      const hasEnd = await page.$(`[id="${endId}"]`);
      console.log(`  날짜셀 [id="${startId}"]: ${hasStart ? "✅" : "❌"}`);
      console.log(`  날짜셀 [id="${endId}"]: ${hasEnd ? "✅" : "❌"}`);
    } else {
      console.log("  ❌ button.custom-selection 없음");
    }

  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
})();
