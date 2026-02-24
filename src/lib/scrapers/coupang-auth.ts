import { Page } from "playwright";

export const COUPANG_BASE = "https://wing.coupang.com";

export const COUPANG_URLS = {
  home: COUPANG_BASE,
  // 쿠팡 판매분석
  salesAnalysis: `${COUPANG_BASE}/tenants/business-insight/sales-analysis`,
  // 쿠팡 로켓그로스 정산
  settlement: `${COUPANG_BASE}/tenants/rfm/settlements/home`,
} as const;

const MANUAL_LOGIN_TIMEOUT = 5 * 60 * 1_000; // 5분

/**
 * 쿠팡 Wing 로그인.
 *
 * 브라우저를 열어 두고 최대 5분간 수동 로그인을 대기.
 *
 * 주의: wing.coupang.com은 지속적인 백그라운드 XHR이 있어
 *       waitForLoadState("networkidle")이 타임아웃됨 → "load" 사용.
 */
export async function loginCoupang(page: Page): Promise<void> {
  await page.goto(COUPANG_BASE);

  // JS 리다이렉트가 완료될 때까지 대기
  await page.waitForURL(
    (url) =>
      url.href.includes("/login") ||
      url.href.includes("/auth") ||
      (url.href.startsWith(COUPANG_BASE) && !url.href.includes("login") && !url.href.includes("auth")),
    { timeout: 15_000 }
  ).catch(() => {});

  const isLoggedIn = () => {
    const url = page.url();
    return (
      url.startsWith(COUPANG_BASE) &&
      !url.includes("/login") &&
      !url.includes("/auth")
    );
  };

  if (isLoggedIn()) return;

  console.log(
    "[쿠팡] 브라우저에서 직접 로그인하세요. 완료 후 자동으로 진행됩니다. (최대 5분)"
  );
  const deadline = Date.now() + MANUAL_LOGIN_TIMEOUT;
  while (Date.now() < deadline) {
    if (isLoggedIn()) {
      await page.waitForLoadState("load");
      await page.waitForTimeout(1_500);
      return;
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error("쿠팡 로그인 타임아웃 (5분 초과). 다시 시도하세요.");
}
