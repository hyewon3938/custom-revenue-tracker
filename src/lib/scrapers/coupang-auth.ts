import { Page, BrowserContext } from "playwright";
import { saveSession } from "./session-store";

export const COUPANG_BASE = "https://wing.coupang.com";

/** 2자리 zero-padding */
export const pad = (n: number): string => String(n).padStart(2, "0");

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
 * context를 전달하면 로그인 성공 후 세션을 자동 저장.
 * 다음 실행 시 저장된 세션으로 로그인을 건너뜀 (TTL 이내인 경우).
 *
 * 주의: wing.coupang.com은 지속적인 백그라운드 XHR이 있어
 *       waitForLoadState("networkidle")이 타임아웃됨 → "load" 사용.
 */
export async function loginCoupang(
  page: Page,
  context?: BrowserContext
): Promise<void> {
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

  // 세션 복원으로 이미 로그인된 경우
  if (isLoggedIn()) return;

  console.log(
    "[쿠팡] 브라우저에서 직접 로그인하세요. 완료 후 자동으로 진행됩니다. (최대 5분)"
  );
  const deadline = Date.now() + MANUAL_LOGIN_TIMEOUT;
  while (Date.now() < deadline) {
    if (isLoggedIn()) {
      await page.waitForLoadState("load");
      await page.waitForTimeout(1_500);
      if (context) await saveSession(context, "coupang");
      return;
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error("쿠팡 로그인 타임아웃 (5분 초과). 다시 시도하세요.");
}
