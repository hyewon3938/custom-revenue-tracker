/** 2자리 zero-padding */
export const pad = (n: number): string => String(n).padStart(2, "0");

/** 원화 표시 — 순수 문자열 (차트 툴팁, 버튼 레이블 등 JSX 불가 영역에서 사용) */
export const formatKRW = (n: number): string =>
  n.toLocaleString("ko-KR") + " 원";

/** 이전 달 계산 */
export function getPrevMonth(year: number, month: number) {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}

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
