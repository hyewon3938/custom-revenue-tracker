/**
 * 실제 Naver/Coupang 페이지의 iframe URL을 출력하는 진단 스크립트
 * 실행: npx tsx scripts/debug-frames.ts
 */
import { chromium } from "playwright";
import { loginNaver, NAVER_URLS } from "../src/lib/scrapers/naver-auth";
import { loginCoupang, COUPANG_URLS } from "../src/lib/scrapers/coupang-auth";

const WAIT_MS = 6_000;

function logFrames(label: string, page: import("playwright").Page) {
  console.log(`\n[${label}] 현재 URL: ${page.url()}`);
  const frames = page.frames();
  if (frames.length === 1) {
    console.log(`  → iframe 없음 (메인 프레임만)`);
  } else {
    frames.forEach((f, i) => console.log(`  frame[${i}]: ${f.url()}`));
  }
}

async function debugNaverSettlement() {
  console.log("\n===== NAVER 정산내역 FRAME DEBUG =====");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await loginNaver(page);
    console.log("✅ 로그인 완료:", page.url());

    // 정산내역으로 직접 이동
    console.log("\n정산내역으로 이동...");
    await page.goto(NAVER_URLS.settlement);
    await page.waitForLoadState("load");
    await new Promise((r) => setTimeout(r, WAIT_MS));
    logFrames("정산내역 (6초 후)", page);

    // 추가 대기
    await new Promise((r) => setTimeout(r, WAIT_MS));
    logFrames("정산내역 (12초 후)", page);

  } finally {
    await browser.close();
  }
}

async function debugNaverSales() {
  console.log("\n===== NAVER 판매분석 FRAME DEBUG =====");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await loginNaver(page);
    console.log("✅ 로그인 완료:", page.url());

    // 판매분석으로 직접 이동
    console.log("\n판매분석으로 이동...");
    await page.goto(NAVER_URLS.salesAnalysis);
    await page.waitForLoadState("load");
    await new Promise((r) => setTimeout(r, WAIT_MS));
    logFrames("판매분석 (6초 후)", page);

    // 리다이렉트됐으면 추가 대기 (사용자가 로그인 완료할 수 있도록)
    if (page.url().includes("login") || page.url().includes("accounts.commerce")) {
      console.log("\n⚠️  bizadvisor 전용 로그인 필요. 브라우저에서 로그인 후 10초 대기...");
      await new Promise((r) => setTimeout(r, 10_000));
      logFrames("판매분석 (로그인 후)", page);
    }

    await new Promise((r) => setTimeout(r, WAIT_MS));
    logFrames("판매분석 (최종)", page);

  } finally {
    await browser.close();
  }
}

async function debugCoupang() {
  console.log("\n===== COUPANG FRAME DEBUG =====");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    await loginCoupang(page);
    console.log("✅ 쿠팡 로그인 완료:", page.url());

    // 판매분석
    console.log("\n쿠팡 판매분석으로 이동...");
    await page.goto(COUPANG_URLS.salesAnalysis);
    await page.waitForLoadState("load");
    await new Promise((r) => setTimeout(r, WAIT_MS));
    logFrames("쿠팡 판매분석", page);

    // 정산
    console.log("\n쿠팡 정산으로 이동...");
    await page.goto(COUPANG_URLS.settlement);
    await page.waitForLoadState("load");
    await new Promise((r) => setTimeout(r, WAIT_MS));
    logFrames("쿠팡 정산", page);

  } finally {
    await browser.close();
  }
}

(async () => {
  const target = process.argv[2]; // "naver-settlement" | "naver-sales" | "coupang" | (없으면 전체)

  if (!target || target === "naver-settlement") {
    await debugNaverSettlement().catch((e) => console.error("정산내역 에러:", e.message));
  }
  if (!target || target === "naver-sales") {
    await debugNaverSales().catch((e) => console.error("판매분석 에러:", e.message));
  }
  if (!target || target === "coupang") {
    await debugCoupang().catch((e) => console.error("쿠팡 에러:", e.message));
  }
  console.log("\n===== 완료 =====");
})();
