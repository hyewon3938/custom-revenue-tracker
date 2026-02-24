/**
 * 각 스크레이퍼 개별 테스트 — 실제 에러 확인용
 * 실행: npx tsx scripts/test-scrapers.ts [naver-sales|naver-settlement|coupang-sales|coupang-settlement]
 */
import { chromium } from "playwright";
import { loginNaver, getFrameByUrl, NAVER_URLS } from "../src/lib/scrapers/naver-auth";
import { loginCoupang } from "../src/lib/scrapers/coupang-auth";
import { scrapeNaverSalesAnalysis } from "../src/lib/scrapers/naver-sales";
import { scrapeNaverSettlement } from "../src/lib/scrapers/naver-settlement";
import { setDateRangeWithCalendar } from "../src/lib/scrapers/naver-datepicker";
import { scrapeCoupangSalesAnalysis } from "../src/lib/scrapers/coupang-sales";
import { scrapeCoupangSettlement } from "../src/lib/scrapers/coupang-settlement";

const YEAR = 2026, MONTH = 2;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function testNaverSales() {
  console.log("\n=== 네이버 판매분석 ===");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  try {
    await loginNaver(page);
    console.log("로그인 완료:", page.url());
    const result = await scrapeNaverSalesAnalysis(page, YEAR, MONTH);
    console.log("✅ 결과:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("❌ 에러:", e);
  } finally {
    await browser.close();
  }
}

async function testNaverSettlement() {
  console.log("\n=== 네이버 정산내역 (디버그) ===");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  try {
    await loginNaver(page);
    console.log("로그인 완료:", page.url());

    await page.goto(NAVER_URLS.settlement);
    const frame = await getFrameByUrl(page, "/e/v3/settlemgt/", 45_000);
    console.log("✅ 프레임 획득:", frame.url());

    // 팝업 닫기
    try {
      await frame.click('button.close[data-dismiss="mySmallModalLabel"]', { timeout: 3_000 });
      console.log("팝업 닫힘");
    } catch { console.log("팝업 없음 (무시)"); }

    // 날짜 설정 전 값 확인
    const beforeDates = await frame.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[title="날짜선택"]'));
      return inputs.map((el) => (el as HTMLInputElement).value);
    });
    console.log("날짜 설정 전:", beforeDates);

    await setDateRangeWithCalendar(frame, YEAR, MONTH);

    // 날짜 설정 후 값 확인
    const afterDates = await frame.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[title="날짜선택"]'));
      return inputs.map((el) => (el as HTMLInputElement).value);
    });
    console.log("날짜 설정 후:", afterDates);

    const result = await scrapeNaverSettlement(page, YEAR, MONTH);
    console.log("✅ 결과:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("❌ 에러:", e);
  } finally {
    await browser.close();
  }
}

async function testCoupangSales() {
  console.log("\n=== 쿠팡 판매분析 ===");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  try {
    await loginCoupang(page);
    console.log("로그인 완료:", page.url());
    const result = await scrapeCoupangSalesAnalysis(page, YEAR, MONTH);
    console.log("✅ 결과:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("❌ 에러:", e);
  } finally {
    await browser.close();
  }
}

async function testCoupangSettlement() {
  console.log("\n=== 쿠팡 정산 ===");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  try {
    await loginCoupang(page);
    console.log("로그인 완료:", page.url());
    const result = await scrapeCoupangSettlement(page, YEAR, MONTH);
    console.log("✅ 결과:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("❌ 에러:", e);
  } finally {
    await browser.close();
  }
}

const target = process.argv[2];
(async () => {
  if (!target || target === "naver-sales")      await testNaverSales();
  if (!target || target === "naver-settlement") await testNaverSettlement();
  if (!target || target === "coupang-sales")    await testCoupangSales();
  if (!target || target === "coupang-settlement") await testCoupangSettlement();
})();
