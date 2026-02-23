import { Page } from "playwright";
import { ProductSales, ProductCategory } from "@/lib/types";
import { NAVER_URLS, getContentFrame } from "./naver-auth";
import { selectMonthRangeAndSearch } from "./naver-datepicker";

/** 상품명으로 카테고리 자동 판별 (끈갈피 = handmade) */
export function detectCategory(productName: string): ProductCategory {
  const handmadeKeywords = ["끈갈피", "북마크", "책갈피"];
  return handmadeKeywords.some((kw) => productName.includes(kw))
    ? "handmade"
    : "other";
}

/**
 * 네이버 주문통합검색 → 제품별 판매 수량/매출 추출
 * 대상 URL: https://sell.smartstore.naver.com/#/naverpay/manage/order
 *
 * 실제 콘텐츠는 /o/v3/manage/order iframe 안에 있음.
 */
export async function scrapeNaverOrders(
  page: Page,
  year: number,
  month: number
): Promise<ProductSales[]> {
  await page.goto(NAVER_URLS.orders);
  await page.waitForLoadState("networkidle");

  const frame = await getContentFrame(page);

  // ── 날짜 범위 선택 + 검색 ────────────────────────────────────────────
  await selectMonthRangeAndSearch(frame, year, month);
  // ────────────────────────────────────────────────────────────────────────

  const productMap = new Map<string, ProductSales>();

  // ── 주문 목록 파싱 (페이징 전체 순회) ────────────────────────────────
  // TODO: 아래 셀렉터를 실제 DOM에 맞게 교체 필요
  //
  // let hasNextPage = true;
  // while (hasNextPage) {
  //   const rows = await frame.$$("TODO: 주문 테이블 행 셀렉터");
  //   for (const row of rows) {
  //     const productName =
  //       (await row.$eval("TODO: 상품명 셀", (el) => el.textContent))
  //         ?.trim() ?? "";
  //     const quantity = parseInt(
  //       (await row.$eval("TODO: 수량 셀", (el) => el.textContent))
  //         ?.replace(/[^\d]/g, "") ?? "0"
  //     );
  //     const revenue = parseInt(
  //       (await row.$eval("TODO: 주문금액 셀", (el) => el.textContent))
  //         ?.replace(/[^\d]/g, "") ?? "0"
  //     );
  //
  //     if (!productName) continue;
  //     if (!productMap.has(productName)) {
  //       productMap.set(productName, {
  //         productId: productName,
  //         productName,
  //         category: detectCategory(productName),
  //         platform: "naver",
  //         quantity: 0,
  //         revenue: 0,
  //       });
  //     }
  //     const entry = productMap.get(productName)!;
  //     entry.quantity += quantity;
  //     entry.revenue += revenue;
  //   }
  //
  //   const nextBtn = await frame.$("TODO: 다음 페이지 버튼:not([disabled])");
  //   if (nextBtn) {
  //     await nextBtn.click();
  //     await frame.waitForLoadState("networkidle");
  //   } else {
  //     hasNextPage = false;
  //   }
  // }
  // ────────────────────────────────────────────────────────────────────────

  return Array.from(productMap.values());
}
