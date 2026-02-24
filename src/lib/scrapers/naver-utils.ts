import { Frame } from "playwright";

/**
 * 네이버 npay_grid_area 페이지네이션 — 다음 페이지 이동.
 * 정산내역 · 주문통합검색에서 공통으로 사용하는 DOM 구조:
 *   div.npay_grid_area > div.grid (테이블) + 다음 DIV형제 (페이지 버튼)
 *   현재 페이지: <strong>N</strong>, 다음 페이지: 숫자 텍스트 버튼
 *
 * @returns 다음 페이지가 있어 클릭했으면 true, 마지막 페이지면 false
 */
export async function goToNextPageInGrid(frame: Frame): Promise<boolean> {
  return frame.evaluate(() => {
    const gridArea = document.querySelector("div.npay_grid_area");
    if (!gridArea) return false;

    const gridDiv = gridArea.querySelector("div.grid");
    if (!gridDiv) return false;

    // div.grid 다음 형제 중 첫 번째 DIV = 페이지네이션 컨테이너
    let paginationContainer: Element | null = null;
    let sibling = gridDiv.nextElementSibling;
    while (sibling) {
      if (sibling.tagName === "DIV") { paginationContainer = sibling; break; }
      sibling = sibling.nextElementSibling;
    }
    if (!paginationContainer) return false;

    // 자식이 없으면 컨테이너 자체가 단일 버튼인 경우
    const children = Array.from(paginationContainer.children);
    const searchScope = children.length > 0 ? children : [paginationContainer];

    // 현재 페이지(<strong>) 위치 → 다음 버튼은 currentIdx + 1
    const currentIdx = searchScope.findIndex(
      (el) => el.querySelector("strong") || el.tagName === "STRONG"
    );
    if (currentIdx === -1) return false;

    const nextBtn = searchScope[currentIdx + 1];
    if (!nextBtn || !/^\d+$/.test(nextBtn.textContent?.trim() ?? "")) return false;

    (nextBtn as HTMLElement).click();
    return true;
  });
}
