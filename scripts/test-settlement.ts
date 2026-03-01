/**
 * 정산 스크레이퍼 단독 테스트
 * 사용법: npx tsx scripts/test-settlement.ts [naver|coupang] [year] [month]
 * 예: npx tsx scripts/test-settlement.ts naver 2026 2
 */

import { resolve } from "path";
import { existsSync, readFileSync } from "fs";

// .env.local 수동 로드 (config.ts import 전에 필요)
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

import { chromium } from "playwright";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SESSION_DIR = resolve(__dirname, "../.browser-session");

async function main() {
  const [, , platform = "naver", yearStr = "2026", monthStr = "2"] = process.argv;
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  console.log(`\n🧪 ${platform} 정산 테스트: ${year}년 ${month}월\n`);

  const sessionFile = resolve(SESSION_DIR, `${platform}-session.json`);
  const hasSession = existsSync(sessionFile);
  console.log(`세션 파일: ${hasSession ? "있음" : "없음 (로그인 필요)"}`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: BROWSER_UA,
    ...(hasSession ? { storageState: sessionFile } : {}),
  });
  const page = await context.newPage();

  try {
    if (platform === "naver") {
      const { scrapeNaverSettlement } = await import("../src/lib/scrapers/naver-settlement");
      const { loginNaver } = await import("../src/lib/scrapers/naver-auth");

      console.log("1. 네이버 로그인...");
      await loginNaver(page, context);
      console.log("✅ 로그인 완료\n");

      console.log("2. 정산내역 스크레이핑...");
      const result = await scrapeNaverSettlement(page, year, month);
      console.log("✅ 결과:");
      console.log(`   정산금액: ${result.settlementAmount.toLocaleString()}원`);
      console.log(`   수수료: ${result.commissionFee.toLocaleString()}원`);
    } else {
      const { scrapeCoupangSettlement } = await import("../src/lib/scrapers/coupang-settlement");
      const { loginCoupang } = await import("../src/lib/scrapers/coupang-auth");

      console.log("1. 쿠팡 로그인...");
      await loginCoupang(page, context);
      console.log("✅ 로그인 완료\n");

      console.log("2. 정산 스크레이핑...");
      const result = await scrapeCoupangSettlement(page, year, month);
      console.log("✅ 결과:");
      console.log(`   매출: ${result.revenue.toLocaleString()}원`);
      console.log(`   수수료: ${result.commissionFee.toLocaleString()}원`);
      console.log(`   물류비: ${result.logisticsFee.toLocaleString()}원`);
      console.log(`   광고비: ${result.adFee.toLocaleString()}원`);
    }
  } catch (err) {
    console.error(`\n❌ 에러: ${err instanceof Error ? err.message : err}`);
    // 에러 시 스크린샷 저장
    const ssPath = resolve(__dirname, `${platform}-settlement-error.png`);
    await page.screenshot({ path: ssPath, fullPage: true });
    console.log(`📸 스크린샷 저장: ${ssPath}`);
  } finally {
    // 브라우저 10초간 유지 (디버그용)
    console.log("\n🔍 10초 후 브라우저 종료...");
    await new Promise((r) => setTimeout(r, 10_000));
    await context.close();
    await browser.close();
  }
}

main();
