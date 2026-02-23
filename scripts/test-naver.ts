/**
 * 네이버 스마트스토어 접근 테스트 스크립트
 *
 * 실행: npm run test:naver
 */

import { chromium } from "playwright";
import * as path from "path";
import * as readline from "readline";
import { selectMonthRangeAndSearch } from "../src/lib/scrapers/naver-datepicker";

const USER_DATA_DIR = path.join(process.cwd(), ".browser-session", "naver");
const NAVER_BASE = "https://sell.smartstore.naver.com";
const ORDER_URL = `${NAVER_BASE}/#/naverpay/manage/order`;

async function waitForEnter(message: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => { rl.question(message, () => { rl.close(); resolve(); }); });
}

async function getContentFrame(page: import("playwright").Page) {
  const isContent = (url: string) => url.includes("/o/v3/") || url.includes("/o/v2/");
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const frame = page.frames().find((f) => isContent(f.url()));
    if (frame) return frame;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("콘텐츠 iframe을 찾을 수 없습니다.");
}

async function main() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  console.log(`테스트 기간: ${year}년 ${month}월 1일 ~ 말일\n`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    args: ["--no-sandbox"],
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // 1단계: 로그인
  await page.goto(NAVER_BASE);
  try {
    await page.waitForURL(`${NAVER_BASE}/**`, { timeout: 10_000 });
    console.log("기존 세션으로 자동 로그인됨.");
  } catch {
    console.log("브라우저에서 직접 로그인해주세요.");
    await waitForEnter("로그인 완료 후 Enter: ");
    await page.waitForURL(`${NAVER_BASE}/**`, { timeout: 15_000 });
  }

  // 2단계: 주문통합검색 이동
  console.log("\n주문통합검색 페이지로 이동 중...");
  await page.goto(ORDER_URL);
  await page.waitForLoadState("networkidle");

  const frame = await getContentFrame(page);
  console.log(`콘텐츠 iframe: ${frame.url()}`);

  // 3단계: 이번 달 1일~말일 선택 후 검색
  console.log(`\n날짜 선택 중 (${year}.${String(month).padStart(2, "0")})...`);
  await selectMonthRangeAndSearch(frame, year, month);
  console.log("검색 완료!");

  // 4단계: 결과 스크린샷
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const screenshotPath = path.join(process.cwd(), "scripts", "screenshot-naver.png");
  await page.screenshot({ path: screenshotPath });
  console.log(`스크린샷: ${screenshotPath}`);

  await waitForEnter("\nEnter로 종료...");
  await context.close();
}

main().catch((err) => { console.error("오류:", err); process.exit(1); });
