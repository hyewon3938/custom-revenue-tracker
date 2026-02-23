import { Frame } from "playwright";

/**
 * 네이버 스마트스토어 공통 react-datepicker 헬퍼
 * 헤더 형식: "2025.10" / 날짜 셀 클래스: react-datepicker__day--XXX (3자리)
 *
 * 주의: 스마트스토어 콘텐츠는 /o/v3/ iframe 안에 있으므로
 *       page가 아닌 Frame을 인자로 받음 (getContentFrame()으로 획득)
 */

const SEL = {
  fromButton:
    '[data-testid="DatePicker::Button::PeriodPicker::From::"]',
  toButton:
    '[data-testid="DatePicker::Button::PeriodPicker::To::"]',
  calendar: ".react-datepicker",
  // 커스텀 헤더 버튼 (텍스트 기반 - 해시 클래스보다 안정적)
  prevMonth: '.react-datepicker__header--custom button:has-text("이전 달")',
  nextMonth: '.react-datepicker__header--custom button:has-text("다음 달")',
  searchButton: 'button.size_large.type_green:has-text("검색")',
  dayCell: (day: number) =>
    `.react-datepicker__day--${String(day).padStart(3, "0")}:not(.react-datepicker__day--outside-month)`,
} as const;

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
 * 시작일(1일) ~ 종료일(말일) 선택 후 검색 버튼 클릭
 *
 * @param page    Playwright Page
 * @param year    조회 연도
 * @param month   조회 월 (1~12)
 */
export async function selectMonthRangeAndSearch(
  page: Frame,
  year: number,
  month: number
): Promise<void> {
  const lastDay = new Date(year, month, 0).getDate();

  // 1) 시작일: 해당 월 1일 선택
  await page.click(SEL.fromButton);
  await page.waitForSelector(SEL.calendar, { state: "visible" });
  await navigateToMonth(page, year, month);
  await page.click(SEL.dayCell(1));

  // 2) 종료일: 해당 월 말일 선택
  await page.click(SEL.toButton);
  await page.waitForSelector(SEL.calendar, { state: "visible" });
  await navigateToMonth(page, year, month);
  await page.click(SEL.dayCell(lastDay));

  // 3) 검색
  await page.click(SEL.searchButton);
  await page.waitForLoadState("networkidle");
}
