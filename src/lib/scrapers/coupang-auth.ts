import { Page } from "playwright";

export const COUPANG_BASE = "https://wing.coupang.com";

export const COUPANG_URLS = {
  home: COUPANG_BASE,
  // 쿠팡 판매분석
  salesAnalysis: `${COUPANG_BASE}/tenants/business-insight/sales-analysis`,
  // 쿠팡 로켓그로스 정산
  settlement: `${COUPANG_BASE}/tenants/rfm/settlements/home`,
} as const;

export async function loginCoupang(page: Page): Promise<void> {
  const username = process.env.COUPANG_USERNAME;
  const password = process.env.COUPANG_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "COUPANG_USERNAME, COUPANG_PASSWORD 환경변수가 필요합니다."
    );
  }

  await page.goto(COUPANG_BASE);
  await page.waitForLoadState("networkidle");

  // 이미 Wing에 로그인된 경우 스킵
  if (!page.url().includes("login") && page.url().startsWith(COUPANG_BASE)) {
    return;
  }

  // TODO: 실제 로그인 셀렉터 확인 필요
  // 쿠팡 Wing 로그인 페이지
  await page.waitForSelector("#username", { timeout: 10_000 });
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');

  await page.waitForURL(`${COUPANG_BASE}/**`, { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}
