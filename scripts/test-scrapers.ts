/**
 * 각 스크레이퍼 개별 테스트 — 실제 에러 확인용
 * 실행: npx tsx scripts/test-scrapers.ts [naver-sales|naver-settlement|naver-orders|coupang-sales|coupang-settlement]
 */
import { chromium } from "playwright";
import { loginNaver, getFrameByUrl, NAVER_URLS } from "../src/lib/scrapers/naver-auth";
import { loginCoupang } from "../src/lib/scrapers/coupang-auth";
import { scrapeNaverSalesAnalysis } from "../src/lib/scrapers/naver-sales";
import { scrapeNaverSettlement } from "../src/lib/scrapers/naver-settlement";
import { scrapeNaverOrders } from "../src/lib/scrapers/naver-orders";
import { setDateRangeWithCalendar } from "../src/lib/scrapers/naver-datepicker";
import { scrapeCoupangSalesAnalysis } from "../src/lib/scrapers/coupang-sales";
import { scrapeCoupangSettlement } from "../src/lib/scrapers/coupang-settlement";

const YEAR = 2025, MONTH = 10;
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

async function testNaverOrders() {
  console.log("\n=== 네이버 주문통합검색 ===");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  try {
    await loginNaver(page);
    console.log("로그인 완료:", page.url());

    const { getContentFrame } = await import("../src/lib/scrapers/naver-auth");
    const { setDateRangeWithCalendar } = await import("../src/lib/scrapers/naver-datepicker");

    await page.goto("https://sell.smartstore.naver.com/#/naverpay/manage/order");
    await page.waitForLoadState("load");
    const frame = await getContentFrame(page);
    console.log("프레임 URL:", frame.url());

    // 날짜 설정 전 값
    const before = await frame.evaluate(() =>
      Array.from(document.querySelectorAll('input[title="날짜선택"]')).map(
        (el) => (el as HTMLInputElement).value
      )
    );
    console.log("날짜 설정 전:", before);

    // PeriodPicker testid 매칭 확인
    const testidCheck = await frame.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid*="PeriodPicker"]')).map(
        (el) => `${el.tagName} data-testid="${el.getAttribute("data-testid")}" value="${(el as HTMLInputElement).value ?? ""}"`
      )
    );
    console.log("PeriodPicker 요소:", testidCheck);

    // 캘린더 열고 안에 뭐가 있는지 확인
    await frame.locator('[data-testid*="Button::PeriodPicker::From"]').click();
    await frame.waitForSelector(".react-datepicker", { state: "visible", timeout: 5_000 });
    const calDom = await frame.evaluate(() => {
      const cal = document.querySelector(".react-datepicker");
      if (!cal) return "캘린더 없음";
      // data-testid 가진 모든 요소
      const els = Array.from(cal.querySelectorAll("[data-testid]"));
      return els.map(el => `${el.tagName} data-testid="${el.getAttribute("data-testid")}" text="${el.textContent?.trim().slice(0,20)}"`);
    });
    console.log("캘린더 내부 요소:", calDom);
    // Esc로 닫기
    await frame.press("body", "Escape");
    await frame.waitForTimeout(300);

    await setDateRangeWithCalendar(frame, YEAR, MONTH, "Input::PeriodPicker::From", "Input::PeriodPicker::To");

    // 날짜 설정 후 값
    const after = await frame.evaluate(() =>
      Array.from(document.querySelectorAll('input[title="날짜선택"]')).map(
        (el) => (el as HTMLInputElement).value
      )
    );
    console.log("날짜 설정 후:", after);

    // 목록 총 개수 (_listTotalCount)
    await frame.waitForSelector("table.tui-grid-table", { timeout: 15_000 });
    const totalCount = await frame.evaluate(() => {
      const el = document.querySelector("b._listTotalCount, .point_color._listTotalCount");
      return el?.textContent?.trim() ?? "찾을 수 없음";
    });
    console.log("목록 총 개수:", totalCount);

    // 테이블 행 수 + 필터 현황 + 셀 구조
    const tableDebug = await frame.evaluate(() => {
      const tables = Array.from(document.querySelectorAll("table.tui-grid-table"));
      const table = tables[tables.length - 1];
      if (!table) return { rowCount: 0, skippedShort: 0, skippedCancel: 0, sampleRows: [] };

      const rows = Array.from(table.querySelectorAll("tbody tr"));
      let skippedShort = 0, skippedCancel = 0;
      const sampleRows: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const cells = Array.from(rows[i].querySelectorAll("td"));
        if (cells.length < 10) { skippedShort++; continue; }
        const first5 = cells.slice(0, 5).map(c => c.textContent?.trim() ?? "").join("|");
        if (first5.includes("취소")) { skippedCancel++; continue; }
        if (sampleRows.length < 5) {
          const allCells = cells.map((c, idx) => `[${idx}]${c.textContent?.trim()?.slice(0, 20) ?? ""}`).join(" ");
          sampleRows.push(`row${i}: ${allCells}`);
        }
      }
      return { rowCount: rows.length, skippedShort, skippedCancel, sampleRows };
    });
    console.log("테이블 행 수:", tableDebug.rowCount);
    console.log("셀 부족으로 건너뜀:", tableDebug.skippedShort);
    console.log("취소 건너뜀:", tableDebug.skippedCancel);
    console.log("유효 행 샘플:");
    tableDebug.sampleRows.forEach(r => console.log(" ", r));

    const result = await scrapeNaverOrders(page, YEAR, MONTH);
    console.log("✅ 결과:", JSON.stringify(result, null, 2));
    console.log("총 상품 종류:", result.length);
    console.log("총 수량:", result.reduce((s, p) => s + p.quantity, 0));

    // --- 스크래핑 완료 후 실제 데이터 상태 확인 ---
    // scrapeNaverOrders 실행 후 페이지는 2025/10 데이터가 로드된 상태
    const frame2 = await (await import("../src/lib/scrapers/naver-auth")).getContentFrame(page);

    const postScrapeDebug = await frame2.evaluate(() => {
      // 목록 총 개수
      const totalCountEl = document.querySelector("b._listTotalCount, .point_color._listTotalCount");
      const totalCount = totalCountEl?.textContent?.trim() ?? "찾을 수 없음";

      // 테이블 행 분석
      const tables = Array.from(document.querySelectorAll("table.tui-grid-table"));
      const table = tables[tables.length - 1];
      if (!table) return { totalCount, rowCount: 0, skippedShort: 0, skippedCancel: 0, extracted: 0 };

      const rows = Array.from(table.querySelectorAll("tbody tr"));
      let skippedShort = 0, skippedCancel = 0, extracted = 0;
      const skippedRows: string[] = [];

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 10) { skippedShort++; continue; }
        const first5 = cells.slice(0, 5).map(c => c.textContent?.trim() ?? "").join("|");
        if (first5.includes("취소")) {
          skippedCancel++;
          skippedRows.push(`취소행: ${first5.slice(0, 80)}`);
          continue;
        }
        extracted++;
      }
      return { totalCount, rowCount: rows.length, skippedShort, skippedCancel, extracted, skippedRows };
    });

    console.log("\n--- 스크래핑 후 실제 데이터 확인 ---");
    console.log("_listTotalCount:", postScrapeDebug.totalCount);
    console.log("테이블 행 수:", postScrapeDebug.rowCount);
    console.log("셀 부족 건너뜀:", postScrapeDebug.skippedShort);
    console.log("취소 건너뜀:", postScrapeDebug.skippedCancel, postScrapeDebug.skippedRows);
    console.log("추출 가능 행:", postScrapeDebug.extracted);
  } catch (e) {
    console.error("❌ 에러:", e);
  } finally {
    await browser.close();
  }
}

async function testCoupangSales() {
  console.log("\n=== 쿠팡 판매분석 ===");
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
  if (!target || target === "naver-sales")        await testNaverSales();
  if (!target || target === "naver-settlement")   await testNaverSettlement();
  if (!target || target === "naver-orders")       await testNaverOrders();
  if (!target || target === "coupang-sales")      await testCoupangSales();
  if (!target || target === "coupang-settlement") await testCoupangSettlement();
})();
