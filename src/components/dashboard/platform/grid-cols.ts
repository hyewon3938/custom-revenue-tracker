/** 한 줄 2등분까지 쓰는 카드 수 상한 */
const TWO_COL_MAX_CARDS = 2;
const THREE_COL_CARDS = 3;
const FOUR_COL_CARDS = 4;

/**
 * 카드 수에 따른 그리드 레이아웃 클래스.
 * 2개 이하: 2등분 / 3개: 3등분 / 4개: 4등분 / 5개+: 한 줄 3개씩.
 * Tailwind 가 찾을 수 있게 클래스는 완성된 리터럴로 둔다.
 */
export function getGridCols(count: number): string {
  if (count <= TWO_COL_MAX_CARDS) return "grid-cols-1 md:grid-cols-2";
  if (count === THREE_COL_CARDS) return "grid-cols-1 md:grid-cols-3";
  if (count === FOUR_COL_CARDS) {
    return "grid-cols-1 md:grid-cols-2 xl:grid-cols-4";
  }
  return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
}
