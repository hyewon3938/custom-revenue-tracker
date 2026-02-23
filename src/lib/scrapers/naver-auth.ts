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
 * - 아직 로드 중이면 framenavigated 이벤트로 대기
 */
export async function getContentFrame(page: Page, timeout = 20_000): Promise<Frame> {
  const isContent = (url: string) =>
    url.includes("/o/v3/") || url.includes("/o/v2/");

  // framenavigated 이벤트는 이미 지나갔을 수 있으므로 폴링 방식 사용
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const frame = page.frames().find((f) => isContent(f.url()));
    if (frame) return frame;
    await new Promise((r) => setTimeout(r, 500));
  }

  // 디버그용: 현재 frame 목록 출력
  const urls = page.frames().map((f) => f.url());
  throw new Error(
    `콘텐츠 iframe을 찾을 수 없습니다.\n현재 frames: ${JSON.stringify(urls)}`
  );
}

export async function loginNaver(page: Page): Promise<void> {
  const id = process.env.NAVER_SMARTSTORE_ID;
  const pw = process.env.NAVER_SMARTSTORE_PASSWORD;

  if (!id || !pw) {
    throw new Error(
      "NAVER_SMARTSTORE_ID, NAVER_SMARTSTORE_PASSWORD 환경변수가 필요합니다."
    );
  }

  await page.goto(NAVER_BASE);
  await page.waitForLoadState("networkidle");

  // 이미 스마트스토어 셀러센터에 로그인된 경우 스킵
  if (page.url().startsWith(NAVER_BASE) && !page.url().includes("login")) {
    return;
  }

  // 네이버 통합 로그인 페이지
  // TODO: 실제 로그인 셀렉터 페이지 검사 후 확인 필요
  // 아이디/비밀번호 탭 선택 후 입력
  await page.waitForSelector("#id", { timeout: 10_000 });
  await page.fill("#id", id);
  await page.fill("#pw", pw);
  await page.click(".btn_login");

  // 로그인 완료 후 스마트스토어 대시보드 로드 대기
  await page.waitForURL(`${NAVER_BASE}/**`, { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
}
