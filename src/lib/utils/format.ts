/** 원화 표시 — 순수 문자열 (차트 툴팁, 버튼 레이블 등 JSX 불가 영역에서 사용) */
export const formatKRW = (n: number): string =>
  n.toLocaleString("ko-KR") + " 원";

/** 이전 달 계산 */
export function getPrevMonth(year: number, month: number) {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}
