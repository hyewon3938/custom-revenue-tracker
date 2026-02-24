import { Frame } from "playwright";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 종료일 계산:
 *  - 현재 월 → 어제 (오늘 날짜는 데이터 미확정이므로 제외)
 *  - 과거 월 → 말일
 *  - 안전 하한: 최소 1일
 */
export function calcEndDay(year: number, month: number): number {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  return isCurrentMonth
    ? Math.max(today.getDate() - 1, 1)
    : lastDayOfMonth;
}

/**
 * TOAST UI Date Input 방식 날짜 범위 설정 + 검색.
 *
 * 대상 페이지: 정산내역, 주문통합검색
 * - 날짜 입력 필드: input[title="날짜선택"] (YYYY.MM.DD 형식)
 * - 시작일 = 해당 월 1일, 종료일 = 말일(과거) 또는 어제(현재 월)
 * - 검색 버튼: button:has-text("검색")
 */
export async function setDateInputRange(
  frame: Frame,
  year: number,
  month: number
): Promise<void> {
  const endDay = calcEndDay(year, month);
  const startDate = `${year}.${pad(month)}.01`;
  const endDate = `${year}.${pad(month)}.${pad(endDay)}`;

  const dateInputs = frame.locator('input[title="날짜선택"]');

  // fill() 은 이벤트를 발생시키지 않아 TOAST UI 가 무시함 → pressSequentially 사용
  await dateInputs.nth(0).click({ clickCount: 3 });
  await dateInputs.nth(0).pressSequentially(startDate);
  await dateInputs.nth(0).press("Tab");
  await frame.waitForTimeout(300);

  await dateInputs.nth(1).click({ clickCount: 3 });
  await dateInputs.nth(1).pressSequentially(endDate);
  await dateInputs.nth(1).press("Tab");
  await frame.waitForTimeout(300);

  await frame.click('button.size_large.type_green:has-text("검색")');
  await frame.waitForLoadState("networkidle");
}


/**
 * 네이버 스마트스토어 공통 react-datepicker 헬퍼
 * 헤더 형식: "2025.10" / 날짜 셀 클래스: react-datepicker__day--XXX (3자리)
 *
 * 주의: 스마트스토어 콘텐츠는 /o/v3/ iframe 안에 있으므로
 *       page가 아닌 Frame을 인자로 받음 (getContentFrame()으로 획득)
 */

const SEL = {
  // 판매분析 날짜 범위 토글 버튼 (달력 열기)
  toggleButton: 'a[data-test-id="DateRangeFixedArea_click_toggle"]',
  calendar: ".calendar_lypop",
  applyButton: 'div.btn_status span.select_range', // "적용" 버튼
  searchButton: 'button.size_large.type_green:has-text("검색")',
} as const;

/**
 * 달력에서 특정 날(숫자)을 텍스트 기반으로 클릭.
 * 클래스명 형식(001 vs 01 vs 1)에 무관하게 동작.
 * outside-month 셀은 제외.
 */
async function clickCalendarDay(page: Frame, day: number): Promise<void> {
  // outside-month 제외한 날짜 셀 중 텍스트가 정확히 일치하는 셀을 Playwright locator로 클릭
  // (evaluate 기반 click은 React 이벤트 시스템에 전달되지 않는 경우 있음)
  const cell = page
    .locator("[class*='react-datepicker__day']:not([class*='outside-month'])")
    .filter({ hasText: new RegExp(`^${day}$`) })
    .first();
  await cell.waitFor({ state: "visible", timeout: 5_000 });
  await cell.click();
}

/**
 * 현재 달력 헤더에서 연월 파싱 ("2026.02" → { year: 2026, month: 2 })
 *
 * 커스텀 헤더를 사용하므로 react-datepicker__current-month 클래스가 없음.
 * 헤더 내에서 "YYYY.MM" 패턴 텍스트를 가진 span을 찾아 파싱.
 */
async function getCurrentCalendarMonth(
  page: Frame
): Promise<{ year: number; month: number }> {
  // 달력 컨테이너가 열릴 때까지 대기
  await page.waitForSelector(".react-datepicker", { state: "visible", timeout: 5_000 });

  const text = await page.evaluate(() => {
    const header = document.querySelector(".react-datepicker__header--custom");
    if (!header) return "";
    const spans = Array.from(header.querySelectorAll("span, div, button"));
    const found = spans.find((el) =>
      /^\d{4}\.\d{2}$/.test(el.textContent?.trim() ?? "")
    );
    return found?.textContent?.trim() ?? "";
  });

  if (!text) {
    throw new Error("달력 헤더에서 연월을 찾을 수 없습니다.");
  }

  const [year, month] = text.split(".").map(Number);
  return { year, month };
}

/** 달력을 목표 연월까지 이전/다음 버튼으로 이동 */
async function navigateToMonth(
  page: Frame,
  targetYear: number,
  targetMonth: number
): Promise<void> {
  const MAX_CLICKS = 24; // 최대 2년 이동
  for (let i = 0; i < MAX_CLICKS; i++) {
    const { year, month } = await getCurrentCalendarMonth(page);
    if (year === targetYear && month === targetMonth) return;

    const prevText = `${year}.${String(month).padStart(2, "0")}`;
    const diff = (targetYear - year) * 12 + (targetMonth - month);
    if (diff > 0) {
      await page.click(SEL.nextMonth);
    } else {
      await page.click(SEL.prevMonth);
    }

    // 헤더 텍스트가 바뀔 때까지 대기 (클릭 직후 DOM 업데이트 보장)
    await page.waitForFunction(
      ({ prev }: { prev: string }) => {
        const header = document.querySelector(".react-datepicker__header--custom");
        if (!header) return false;
        const spans = Array.from(header.querySelectorAll("span, div, button"));
        const cur = spans.find((el) =>
          /^\d{4}\.\d{2}$/.test(el.textContent?.trim() ?? "")
        );
        return cur?.textContent?.trim() !== prev;
      },
      { prev: prevText },
      { timeout: 3_000 }
    );
  }
  throw new Error(
    `달력 이동 실패: ${targetYear}년 ${targetMonth}월에 도달하지 못했습니다.`
  );
}

/**
 * readonly 날짜 인풋(클릭 시 react-datepicker 오픈) 방식 날짜 범위 설정.
 *
 * 대상: 네이버 정산내역 (`/e/v3/settlemgt/`)
 * - 날짜 인풋: input[title="날짜선택"] readonly (클릭 → 달력 오픈)
 * - 검색 버튼: button.size_large.type_green:has-text("검색")
 */
export async function setDateRangeWithCalendar(
  frame: Frame,
  year: number,
  month: number
): Promise<void> {
  const endDay = calcEndDay(year, month);

  // data-testid 부분 일치로 시작일/종료일 인풋 특정
  // (input[title="날짜선택"]이 페이지에 여러 개일 수 있어 nth(0) 오작동 방지)
  const startInput = frame.locator('[data-testid*="Input::DateRange::From"]');
  const endInput = frame.locator('[data-testid*="Input::DateRange::To"]');

  // 시작일: 인풋 클릭 → 캘린더 오픈 → 1일 선택
  await startInput.click();
  await frame.waitForSelector(".react-datepicker", { state: "visible", timeout: 5_000 });
  await navigateToMonth(frame, year, month);
  await clickCalendarDay(frame, 1);
  await frame.waitForTimeout(300);

  // 종료일: 인풋 클릭 → 캘린더 오픈 → 말일/어제 선택
  await endInput.click();
  await frame.waitForSelector(".react-datepicker", { state: "visible", timeout: 5_000 });
  await navigateToMonth(frame, year, month);
  await clickCalendarDay(frame, endDay);
  await frame.waitForTimeout(300);

  // 검색
  await frame.click('button.size_large.type_green:has-text("검색")');
  await frame.waitForLoadState("networkidle");
}

/**
 * 시작일(1일) ~ 종료일(말일) 선택 후 검색 버튼 클릭
 *
 * @param page    Playwright Page
 * @param year    조회 연도
 * @param month   조회 월 (1~12)
 */
/**
 * calendar_lypop 달력에서 특정 연월로 이동.
 * 헤더 텍스트 "YYYY년 MM월" 형식 기준으로 이전/다음 버튼 클릭.
 */
/**
 * calendar_lypop (DayPicker 라이브러리) 달력에서 특정 연월로 이동.
 * 헤더: div.DayPicker-Caption "YYYY. MM."
 * 이전/다음: div.DayPicker-NavButton--prev / --next
 */
async function navigateToMonthLypop(
  page: Frame,
  targetYear: number,
  targetMonth: number
): Promise<void> {
  const MAX_CLICKS = 24;
  for (let i = 0; i < MAX_CLICKS; i++) {
    const { year, month } = await page.evaluate(() => {
      const caption = document.querySelector(".DayPicker-Caption");
      const text = caption?.textContent?.trim() ?? "";
      // "2026. 02." 형식
      const m = text.match(/(\d{4})\.\s*(\d{2})/);
      if (m) return { year: Number(m[1]), month: Number(m[2]) };
      return { year: 0, month: 0 };
    });

    if (year === targetYear && month === targetMonth) return;
    if (year === 0) throw new Error("DayPicker-Caption에서 연월을 찾을 수 없습니다.");

    const diff = (targetYear - year) * 12 + (targetMonth - month);
    if (diff > 0) {
      await page.click(".DayPicker-NavButton--next");
    } else {
      await page.click(".DayPicker-NavButton--prev");
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`DayPicker: ${targetYear}년 ${targetMonth}월에 도달하지 못했습니다.`);
}

/**
 * calendar_lypop (DayPicker) 달력에서 날짜 셀 클릭.
 * DayPicker-Day 클래스, outside/disabled 제외.
 */
async function clickLypopDay(page: Frame, day: number): Promise<void> {
  const cell = page
    .locator(".DayPicker-Day:not(.DayPicker-Day--outside):not(.DayPicker-Day--disabled)")
    .filter({ hasText: new RegExp(`^${day}$`) })
    .first();
  await cell.waitFor({ state: "visible", timeout: 5_000 });
  await cell.click();
}

export async function selectMonthRangeAndSearch(
  page: Frame,
  year: number,
  month: number
): Promise<void> {
  const endDay = calcEndDay(year, month);

  // 1) 토글 버튼 클릭 → calendar_lypop 달력 오픈
  await page.click(SEL.toggleButton);
  await page.waitForSelector(SEL.calendar, { state: "visible", timeout: 10_000 });
  await navigateToMonthLypop(page, year, month);

  // 2) 시작일(1일) 클릭
  await clickLypopDay(page, 1);
  await page.waitForTimeout(300);

  // 3) 종료일 클릭
  await navigateToMonthLypop(page, year, month);
  await clickLypopDay(page, endDay);
  await page.waitForTimeout(300);

  // 4) 적용 버튼 클릭
  await page.click(SEL.applyButton);
  await page.waitForLoadState("networkidle");
}
