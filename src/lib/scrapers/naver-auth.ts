import { Page, Frame } from "playwright";

export const NAVER_BASE = "https://sell.smartstore.naver.com";

export const NAVER_URLS = {
  home: NAVER_BASE,
  // 네이버 주문통합검색
  orders: `${NAVER_BASE}/#/naverpay/manage/order`,
  // 네이버 판매분석
  salesAnalysis: `${NAVER_BASE}/#/bizadvisor/sales`,
  // 네이버 판매자 일별 정산내역
  settlement: `${NAVER_BASE}/#/naverpay/settlemgt/sellerdailysettle`,
} as const;

/**
 * 스마트스토어 SPA 구조:
 *   - 외부 껍데기: https://sell.smartstore.naver.com/#/...  (hash routing)
 *   - 실제 콘텐츠: https://sell.smartstore.naver.com/o/v3/... (iframe)
 *
 * page.goto()로 hash URL로 이동한 뒤, 이 함수로 실제 콘텐츠 frame을 얻어야 함.
 * - 이미 로드된 경우 즉시 반환
 * - 아직 로드 중이면 폴링으로 대기
 *
 * 주문/정산 iframe: /o/v3/ 또는 /o/v2/
 * 정산내역 iframe: /e/v3/settlemgt/  (별도 패턴 — 아래 getFrameByUrl 사용)
 */
export async function getContentFrame(page: Page, timeout = 20_000): Promise<Frame> {
  const isContent = (url: string) =>
    url.includes("/o/v3/") || url.includes("/o/v2/");

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const frame = page.frames().find((f) => isContent(f.url()));
    if (frame) return frame;
    await new Promise((r) => setTimeout(r, 500));
  }

  const urls = page.frames().map((f) => f.url());
  throw new Error(
    `콘텐츠 iframe을 찾을 수 없습니다.\n현재 frames: ${JSON.stringify(urls)}`
  );
}

/**
 * URL에 특정 문자열이 포함된 iframe을 찾아 반환.
 *
 * 용도:
 *   - 네이버 정산내역: getFrameByUrl(page, "/e/v3/settlemgt/")
 *   - 네이버 판매분석: getFrameByUrl(page, "/biz_iframe/")
 */
export async function getFrameByUrl(
  page: Page,
  urlContains: string,
  timeout = 20_000
): Promise<Frame> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const frame = page.frames().find((f) => f.url().includes(urlContains));
    if (frame) return frame;
    await new Promise((r) => setTimeout(r, 500));
  }

  const urls = page.frames().map((f) => f.url());
  throw new Error(
    `iframe을 찾을 수 없습니다 (패턴: "${urlContains}").\n현재 frames: ${JSON.stringify(urls)}`
  );
}

const MANUAL_LOGIN_TIMEOUT = 5 * 60 * 1_000; // 5분

/**
 * 네이버 스마트스토어 로그인.
 *
 * 브라우저를 열어 두고 최대 5분간 수동 로그인을 대기.
 * (2FA·캡차 대응)
 *
 * 로그인 완료 조건:
 *   - sell.smartstore.naver.com 도메인 위
 *   - login 관련 경로(nid.naver.com / accounts.commerce.naver.com / login-callback) 아님
 */
export async function loginNaver(page: Page): Promise<void> {
  await page.goto(NAVER_BASE);

  // JS 리다이렉트가 완료될 때까지 대기
  await page.waitForURL(
    (url) =>
      url.href.includes("nid.naver.com") ||
      url.href.includes("accounts.commerce.naver.com") ||
      (url.href.startsWith(NAVER_BASE) && !url.href.includes("login")),
    { timeout: 15_000 }
  ).catch(() => {});

  const isLoggedInUrl = () => {
    const url = page.url();
    return (
      url.startsWith(NAVER_BASE) &&
      !url.includes("nid.naver.com") &&
      !url.includes("accounts.commerce.naver.com") &&
      !url.includes("login")
    );
  };

  if (isLoggedInUrl()) return;

  console.log(
    "[네이버] 브라우저에서 직접 로그인하세요. 완료 후 자동으로 진행됩니다. (최대 5분)"
  );
  const deadline = Date.now() + MANUAL_LOGIN_TIMEOUT;
  while (Date.now() < deadline) {
    if (isLoggedInUrl()) {
      await page.waitForLoadState("load");
      await page.waitForTimeout(2_000);
      return;
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error("네이버 로그인 타임아웃 (5분 초과). 다시 시도하세요.");
}
