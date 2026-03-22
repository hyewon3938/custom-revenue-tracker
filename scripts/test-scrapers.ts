/**
 * 쿠팡 정산 스크레이퍼 테스트 — 실제 에러 확인용
 * 실행: npx tsx scripts/test-scrapers.ts
 *
 * 네이버: 커머스 API로 전환 → 별도 테스트 불필요
 * 쿠팡 주문: RG Order API로 전환 → 별도 테스트 불필요
 * 쿠팡 정산: RG 정산 API 미제공 → 스크레이퍼 유지
 */
import { chromium } from "playwright";
import { loginCoupang } from "../src/lib/scrapers/coupang-auth";
import { scrapeCoupangSettlement } from "../src/lib/scrapers/coupang-settlement";

const YEAR = 2026, MONTH = 2;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function testCoupangSettlement() {
  console.log("\n=== 쿠팡 정산 ===");
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();
  try {
    await loginCoupang(page);
    console.log("로그인 완료:", page.url());
    const result = await scrapeCoupangSettlement(page, YEAR, MONTH);
    console.log("결과:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("에러:", e);
  } finally {
    await browser.close();
  }
}

testCoupangSettlement();
